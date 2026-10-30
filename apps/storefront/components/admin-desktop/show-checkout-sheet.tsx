'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addCase,
  caseCount,
  checkoutLines,
  findCaseProduct,
  formatCases,
  halfCaseJars,
  isControlCode,
  nextUndated,
  planLines,
  readDateInput,
  removeLastCase,
  setCaseDate,
  type CheckedCase,
  type CheckoutProduct,
  type CheckoutShow,
} from '@/lib/admin-desktop/show-checkout'
import { Icon } from './icons'

type Stage = 'setup' | 'plan' | 'cart'
type Flash = { text: string; detail?: string; tone: 'case' | 'half' | 'date' | 'bad' | 'info' }

const NAME_KEY = 'jms-show-checkout-name'

/** Letters the scan box leaves to the window, so ⌘A/⌘C/⌘V/⌘X/⌘Z still edit the box. */
const EDITING_KEYS = new Set(['a', 'c', 'v', 'x', 'z'])

/**
 * Tones a packer can tell apart without looking: one beep for a case, two for
 * a half case, a rising pair for a date, a low buzz for anything refused.
 */
function tone(kind: Flash['tone']) {
  const notes: Record<Flash['tone'], [number, number][]> = {
    case: [[880, 0.09]],
    half: [
      [660, 0.07],
      [660, 0.07],
    ],
    date: [
      [700, 0.06],
      [1050, 0.08],
    ],
    bad: [[220, 0.35]],
    info: [[520, 0.08]],
  }
  try {
    const context = new AudioContext()
    let at = context.currentTime
    for (const [frequency, length] of notes[kind]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = frequency
      gain.gain.value = 0.08
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(at)
      oscillator.stop(at + length)
      at += length + 0.05
    }
    setTimeout(() => void context.close(), (at - context.currentTime) * 1000 + 100)
  } catch {
    // No audio device, or the window has not been interacted with yet.
  }
}

/** Today in Ohio, as yyyy-mm-dd. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())
}

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function showLabel(show: CheckoutShow): string {
  const date = new Date(show.startDate).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  })
  return [show.title, date, show.location].filter(Boolean).join(' · ')
}

/** A draft manifest's taken quantities, in cases rounded to the half, as the plan. */
function planFrom(show: CheckoutShow | undefined, products: CheckoutProduct[]): Map<string, number> {
  const plan = new Map<string, number>()
  if (show?.manifest?.status !== 'DRAFT') return plan
  const per = new Map(products.map((product) => [product.id, product.unitsPerCase || 12]))
  for (const item of show.manifest.items) {
    const cases = item.takenCases + item.takenJars / (per.get(item.productId) ?? 12)
    if (cases > 0) plan.set(item.productId, Math.round(cases * 2) / 2)
  }
  return plan
}

function printCodes(html: string) {
  const bridge = window.jmsDesktop
  if (bridge?.printDocument) {
    bridge.printDocument(html)
    return
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * Show checkout: load the van by scanning the label on every case.
 *
 * Name, date and show first, then either a plan of how many cases of each
 * salsa to take or straight to scanning. Every case-label scan puts one case
 * on the cart; holding ⌘ (Ctrl on Windows) while it scans makes it half a case.
 * Each scan answers at once, on screen and out loud, so the next case can be
 * grabbed without looking back.
 *
 * When the cart is full, the dates code (or Enter dates) switches to dates:
 * scan a case's label, then type or scan its month and day — the year is three
 * years out. Once every case is dated it goes back to scanning for the next
 * cart. Check out writes the lot onto the show's packing manifest.
 */
export function ShowCheckoutSheet({ onClose, onSaved }: { onClose: () => void; onSaved: (message: string) => void }) {
  const [shows, setShows] = useState<CheckoutShow[] | null>(null)
  const [products, setProducts] = useState<CheckoutProduct[]>([])
  const [codesHtml, setCodesHtml] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const [stage, setStage] = useState<Stage>('setup')
  const [name, setName] = useState(readName)
  const [date, setDate] = useState(today)
  const [showId, setShowId] = useState('')
  const [planned, setPlanned] = useState(false)
  const [plan, setPlan] = useState<Map<string, number>>(() => new Map())

  const [cases, setCases] = useState<CheckedCase[]>([])
  const [dating, setDating] = useState(false)
  /** The case a date goes on, when a label was scanned in dates mode. */
  const [target, setTarget] = useState<number | null>(null)
  const [pendingDigits, setPendingDigits] = useState('')
  const [halfNext, setHalfNext] = useState(false)
  const [code, setCode] = useState('')
  const [flash, setFlash] = useState<Flash | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [discarding, setDiscarding] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  /** What the scanner has typed so far; state lags a fast scanner by a render. */
  const buffer = useRef('')
  /** ⌘ or Ctrl was down for some key of the scan in progress. */
  const heldDuringScan = useRef(false)
  /** ⌘ or Ctrl is down right now. */
  const held = useRef(false)

  useEffect(() => {
    let live = true
    fetch('/api/admin/desktop/show-checkout', { credentials: 'same-origin' })
      .then(async (response) => {
        const body = (await response.json()) as {
          shows?: CheckoutShow[]
          products?: CheckoutProduct[]
          codesHtml?: string
          error?: string
        }
        if (!response.ok || !body.shows) {
          throw new Error(response.status === 403 ? 'Your account cannot read shows.' : body.error ?? 'Could not load shows.')
        }
        if (!live) return
        setShows(body.shows)
        setProducts(body.products ?? [])
        setCodesHtml(body.codesHtml ?? '')
        const now = Date.now() - 24 * 60 * 60 * 1000
        setShowId((body.shows.find((show) => new Date(show.startDate).getTime() >= now) ?? body.shows[0])?.id ?? '')
      })
      .catch((error: unknown) => {
        if (live) setLoadError(error instanceof Error ? error.message : 'Could not load shows.')
      })
    return () => {
      live = false
    }
  }, [])

  // The desktop apps hand ⌘1–⌘9 to their Go menu before the page sees them, so
  // a ⌘-held scan of digits would jump sections. Ask them to stand down while
  // this sheet is open.
  useEffect(() => {
    window.jmsDesktop?.setScanCapture?.(true)
    const release = (event: KeyboardEvent) => {
      if (event.key === 'Meta' || event.key === 'Control') held.current = false
    }
    const blur = () => {
      held.current = false
    }
    window.addEventListener('keyup', release)
    window.addEventListener('blur', blur)
    return () => {
      window.jmsDesktop?.setScanCapture?.(false)
      window.removeEventListener('keyup', release)
      window.removeEventListener('blur', blur)
    }
  }, [])

  const show = shows?.find((entry) => entry.id === showId)
  const byId = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const total = caseCount(cases)
  const undated = cases.filter((entry) => !entry.date).length
  const packedYear = Number(date.slice(0, 4)) || new Date().getFullYear()
  const lines = planLines(products, planned ? plan : new Map(), cases)
  const current = dating ? (target !== null ? cases.find((entry) => entry.seq === target) : undefined) ?? nextUndated(cases) : undefined
  const ready = name.trim().length > 0 && Boolean(show) && /^\d{4}-\d{2}-\d{2}$/.test(date)

  const focus = () => setTimeout(() => inputRef.current?.focus(), 0)
  const say = useCallback((next: Flash) => {
    tone(next.tone)
    setFlash(next)
  }, [])

  function start() {
    if (!ready) return
    try {
      localStorage.setItem(NAME_KEY, name.trim())
    } catch {
      // Private window: the name is simply asked for again next time.
    }
    if (planned) {
      if (plan.size === 0) setPlan(planFrom(show, products))
      setStage('plan')
    } else {
      setStage('cart')
      setFlash({ text: 'Scan the label on each case.', detail: 'Hold ⌘ while scanning for a half case.', tone: 'info' })
      focus()
    }
  }

  function enterDates(on: boolean) {
    setDating(on)
    setTarget(null)
    setPendingDigits('')
    if (on) {
      const first = nextUndated(cases)
      say(
        first
          ? { text: 'Dates', detail: 'Scan a case label, then its month and day. The year fills itself in.', tone: 'info' }
          : { text: 'Every case is dated.', detail: 'Back to scanning.', tone: 'info' },
      )
      if (!first) setDating(false)
    } else {
      say({ text: 'Scanning cases', detail: undated > 0 ? `${undated} still to date.` : undefined, tone: 'info' })
    }
    focus()
  }

  function scanCase(typed: string, half: boolean) {
    const product = findCaseProduct(products, typed)
    if (!product) {
      say({ text: `${typed} is not a case label we know.`, detail: 'Nothing was added. Scan it again or type the SKU.', tone: 'bad' })
      return
    }
    const next = addCase(cases, product.id, half)
    setCases(next)
    setHalfNext(false)
    setSaveError(null)
    const onCart = caseCount(next, product.id)
    const wanted = planned ? plan.get(product.id) ?? 0 : 0
    const planNote = planned
      ? wanted === 0
        ? 'Not on the plan, added anyway.'
        : onCart > wanted
          ? `Over the plan of ${formatCases(wanted)}.`
          : `${formatCases(onCart)} of ${formatCases(wanted)} planned.`
      : undefined
    say({
      text: `${half ? `HALF CASE (${halfCaseJars(product.unitsPerCase)} jars)` : '1 CASE'} · ${product.name}`,
      detail: [`${formatCases(onCart)} on the cart`, planNote].filter(Boolean).join(' · '),
      tone: half ? 'half' : 'case',
    })
  }

  function scanDate(typed: string) {
    const product = findCaseProduct(products, typed)
    if (product) {
      const entry = nextUndated(cases, product.id)
      if (!entry) {
        say({ text: `Every ${product.name} case is dated.`, tone: 'bad' })
        return
      }
      setTarget(entry.seq)
      setPendingDigits('')
      say({ text: `${product.name}${entry.half ? ' (half)' : ''}`, detail: 'Now its month and day.', tone: 'info' })
      return
    }

    const into = current
    if (!into) {
      enterDates(false)
      return
    }
    const read = readDateInput(typed, pendingDigits, packedYear)
    if (read.kind === 'pending') {
      setPendingDigits(read.digits)
      tone('info')
      setFlash({ text: `${read.digits.padEnd(4, '_').replace(/^(..)(..)$/, '$1/$2')}`, detail: 'And the day.', tone: 'info' })
      return
    }
    setPendingDigits('')
    if (read.kind === 'error') {
      say({ text: read.message, tone: 'bad' })
      return
    }
    const next = setCaseDate(cases, into.seq, read.date)
    setCases(next)
    setTarget(null)
    const left = next.filter((entry) => !entry.date).length
    const productName = byId.get(into.productId)?.name ?? 'Case'
    if (left === 0) {
      setDating(false)
      say({ text: `${productName} · ${read.label}`, detail: 'Every case is dated. Back to scanning.', tone: 'date' })
    } else {
      say({ text: `${productName} · ${read.label}`, detail: `${left} more to date.`, tone: 'date' })
    }
  }

  function submit(half: boolean) {
    const typed = buffer.current.trim()
    buffer.current = ''
    setCode('')
    setDiscarding(false)
    if (!typed || saving) return

    const control = isControlCode(typed)
    if (control === 'dates') {
      enterDates(!dating)
      return
    }
    if (control === 'half') {
      setHalfNext(true)
      say({ text: 'Next case is a half case', tone: 'info' })
      return
    }
    if (dating) scanDate(typed)
    else scanCase(typed, half || halfNext)
  }

  async function checkOut() {
    if (!show || saving || cases.length === 0 || undated > 0) return
    setSaving(true)
    setSaveError(null)
    try {
      checkoutLines(products, cases)
      const response = await fetch('/api/admin/desktop/show-checkout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: show.id,
          checkedOutBy: name.trim(),
          checkoutDate: date,
          cases: cases.map(({ productId, half, date: caseDate }) => ({ productId, half, date: caseDate })),
        }),
      })
      const body = (await response.json()) as { message?: string; error?: string }
      if (!response.ok) throw new Error(body.error ?? 'The checkout could not be saved.')
      onSaved(body.message ?? 'Checked out')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'The checkout could not be saved.')
      tone('bad')
      setSaving(false)
    }
  }

  const close = () => {
    if (cases.length > 0 && !discarding) {
      setDiscarding(true)
      setFlash({ text: `Cancel again to discard ${formatCases(total)} scanned ${total === 1 ? 'case' : 'cases'}.`, tone: 'bad' })
      return
    }
    onClose()
  }

  const flashClass =
    flash?.tone === 'bad'
      ? 'jmsd-checkout-flash--bad'
      : flash?.tone === 'half'
        ? 'jmsd-checkout-flash--half'
        : flash?.tone === 'case' || flash?.tone === 'date'
          ? 'jmsd-checkout-flash--good'
          : ''

  return (
    <div className="jmsd-scrim" role="presentation" onMouseDown={saving ? undefined : close}>
      <div
        className="jmsd-sheet jmsd-sheet--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Show checkout"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !saving) close()
        }}
      >
        <header className="jmsd-sheet-head">
          <div className="jmsd-sheet-heading">
            <div className="jmsd-sheet-title">{stage === 'setup' ? 'Show checkout' : `Show checkout · ${show?.title ?? ''}`}</div>
            <div className="jmsd-sheet-subtitle">
              {stage === 'setup'
                ? 'Who is packing, when, and for which show. Then plan the load or go straight to scanning case labels.'
                : [name.trim(), date.slice(5).replace('-', '/') + '/' + date.slice(2, 4), show?.location].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button type="button" className="jmsd-icon-button" onClick={close} disabled={saving} aria-label="Close">
            <Icon name="i-close" size={14} />
          </button>
        </header>

        <div className="jmsd-sheet-body">
          {loadError ? <div className="jmsd-sheet-error">{loadError}</div> : null}

          {stage === 'setup' ? (
            <div className="jmsd-sheet-grid">
              <div className="jmsd-field-block">
                <label className="jmsd-field-label" htmlFor="jmsd-checkout-name">
                  Your name<span className="jmsd-tone-bad"> *</span>
                </label>
                <input
                  id="jmsd-checkout-name"
                  className="jmsd-input"
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="jmsd-field-block">
                <label className="jmsd-field-label" htmlFor="jmsd-checkout-date">
                  Date<span className="jmsd-tone-bad"> *</span>
                </label>
                <input
                  id="jmsd-checkout-date"
                  type="date"
                  className="jmsd-input"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="jmsd-field-block jmsd-field-block--wide">
                <label className="jmsd-field-label" htmlFor="jmsd-checkout-show">
                  Show<span className="jmsd-tone-bad"> *</span>
                </label>
                <select
                  id="jmsd-checkout-show"
                  className="jmsd-input"
                  value={showId}
                  disabled={!shows}
                  onChange={(event) => {
                    setShowId(event.target.value)
                    setPlan(new Map())
                  }}
                >
                  <option value="">{shows ? 'Choose a show…' : 'Loading shows…'}</option>
                  {(shows ?? []).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {showLabel(entry)}
                    </option>
                  ))}
                </select>
                <div className="jmsd-field-help">
                  {show?.manifest?.status === 'PACKED'
                    ? 'Already checked out once. This cart is added to what went out.'
                    : show?.manifest?.status === 'RETURNED'
                      ? 'This show is marked Returned. Reopen its manifest before checking more out.'
                      : 'Shows from Events & Shows. Add the show there first if it is not listed.'}
                </div>
              </div>
              <div className="jmsd-field-block jmsd-field-block--wide">
                <span className="jmsd-field-label">How</span>
                <div className="jmsd-scan-modes" role="group" aria-label="How to check out">
                  <button type="button" className="jmsd-chip" aria-pressed={!planned} onClick={() => setPlanned(false)}>
                    Scan as you go
                  </button>
                  <button type="button" className="jmsd-chip" aria-pressed={planned} onClick={() => setPlanned(true)}>
                    Plan the load first
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {stage === 'plan' ? (
            <>
              <div className="jmsd-field-help">
                Cases of each salsa to take. Halves are fine (1.5).{' '}
                {show?.manifest?.status === 'DRAFT' ? 'Filled in from the show form.' : ''}
              </div>
              <table className="jmsd-scan-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="jmsd-cell--right">Cases</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td className="jmsd-field-help">{product.category}</td>
                      <td className="jmsd-cell--right">
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          className="jmsd-input jmsd-checkout-plan-input"
                          aria-label={`${product.name} cases planned`}
                          value={plan.get(product.id) || ''}
                          onChange={(event) => {
                            const value = Math.max(0, Math.round((Number(event.target.value) || 0) * 2) / 2)
                            setPlan((previous) => {
                              const next = new Map(previous)
                              if (value > 0) next.set(product.id, value)
                              else next.delete(product.id)
                              return next
                            })
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {stage === 'cart' ? (
            <>
              <div className="jmsd-checkout-mode">
                <span className={`jmsd-checkout-badge ${dating ? 'jmsd-checkout-badge--dates' : ''}`}>
                  {dating ? 'DATES' : 'SCANNING'}
                </span>
                <span className="jmsd-field-help">
                  {dating
                    ? current
                      ? `Case ${current.seq}: ${byId.get(current.productId)?.name ?? ''}${current.half ? ' (half)' : ''}. Type or scan MM/DD, year ${String(packedYear + 3).slice(-2)}.`
                      : 'Scan a case label.'
                    : halfNext
                      ? 'Next case is a half case.'
                      : 'Each scan is 1 case. Hold ⌘ while scanning for a half case.'}
                </span>
                <span className="jmsd-checkout-total">{formatCases(total)}</span>
              </div>

              <input
                ref={inputRef}
                autoFocus
                className="jmsd-input jmsd-scan-input"
                value={code}
                disabled={saving}
                placeholder={dating ? 'Scan a case label, then type or scan MM/DD' : 'Scan a case label'}
                aria-label={dating ? 'Case label or date' : 'Case label'}
                onChange={(event) => {
                  buffer.current = event.target.value
                  setCode(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Meta' || event.key === 'Control') {
                    held.current = true
                    return
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    const half = heldDuringScan.current || held.current || event.metaKey || event.ctrlKey
                    heldDuringScan.current = false
                    submit(half)
                    return
                  }
                  const accel = event.metaKey || event.ctrlKey
                  if (accel) heldDuringScan.current = true
                  // ⌘ held: the box will not type the character itself, so add it here.
                  if (accel && event.key.length === 1 && !EDITING_KEYS.has(event.key.toLowerCase())) {
                    event.preventDefault()
                    buffer.current += event.key
                    setCode(buffer.current)
                  }
                }}
              />

              {flash ? (
                <div className={`jmsd-checkout-flash ${flashClass}`} role="status" aria-live="assertive">
                  <div className="jmsd-checkout-flash-text">{flash.text}</div>
                  {flash.detail ? <div className="jmsd-checkout-flash-detail">{flash.detail}</div> : null}
                </div>
              ) : null}
              {saveError ? <div className="jmsd-sheet-error">{saveError}</div> : null}

              {lines.length > 0 ? (
                <table className="jmsd-scan-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      {planned ? <th className="jmsd-cell--right">Planned</th> : null}
                      <th className="jmsd-cell--right">Cases</th>
                      <th>Dates</th>
                      <th aria-label="Adjust" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line) => {
                      const mine = cases.filter((entry) => entry.productId === line.product.id)
                      const missing = mine.filter((entry) => !entry.date).length
                      const met = planned && line.planned > 0 && line.scanned >= line.planned
                      return (
                        <tr key={line.product.id} className={met ? 'jmsd-tone-good' : undefined}>
                          <td>
                            {line.product.name}
                            {!line.product.barcode ? <div className="jmsd-field-help">No barcode on file — type the SKU</div> : null}
                          </td>
                          {planned ? <td className="jmsd-cell--right jmsd-mono">{formatCases(line.planned)}</td> : null}
                          <td className="jmsd-cell--right jmsd-mono">{formatCases(line.scanned)}</td>
                          <td className="jmsd-mono">
                            {[...new Set(mine.flatMap((entry) => (entry.date ? [entry.date] : [])))]
                              .sort()
                              .map((value) => `${value.slice(5, 7)}/${value.slice(8)}/${value.slice(2, 4)}`)
                              .join(', ')}
                            {missing > 0 ? <span className="jmsd-tone-warn"> {missing} to date</span> : null}
                          </td>
                          <td className="jmsd-scan-adjust">
                            <button
                              type="button"
                              className="jmsd-chip"
                              aria-label={`One fewer ${line.product.name} case`}
                              disabled={line.scanned === 0 || saving}
                              onClick={() => {
                                setCases((previous) => removeLastCase(previous, line.product.id))
                                focus()
                              }}
                            >
                              −
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className="jmsd-sheet-foot">
          <span className="jmsd-field-help">
            {stage === 'cart'
              ? `${formatCases(total)} ${total === 1 ? 'case' : 'cases'}${undated > 0 ? ` · ${undated} to date` : cases.length > 0 ? ' · all dated' : ''}`
              : ''}
          </span>
          <div className="jmsd-sheet-buttons">
            {codesHtml ? (
              <button type="button" className="jmsd-action" onClick={() => printCodes(codesHtml)}>
                Print code sheet
              </button>
            ) : null}
            <button type="button" className="jmsd-action" onClick={close} disabled={saving}>
              {discarding ? 'Discard scans' : 'Cancel'}
            </button>
            {stage === 'setup' ? (
              <button
                type="button"
                className="jmsd-action jmsd-action--primary"
                disabled={!ready || show?.manifest?.status === 'RETURNED'}
                onClick={start}
              >
                {planned ? 'Plan the load' : 'Start scanning'}
              </button>
            ) : null}
            {stage === 'plan' ? (
              <button
                type="button"
                className="jmsd-action jmsd-action--primary"
                onClick={() => {
                  setStage('cart')
                  setFlash({ text: 'Scan the label on each case.', detail: 'Hold ⌘ while scanning for a half case.', tone: 'info' })
                  focus()
                }}
              >
                Start scanning
              </button>
            ) : null}
            {stage === 'cart' ? (
              <>
                <button type="button" className="jmsd-action" disabled={cases.length === 0 || saving} onClick={() => enterDates(!dating)}>
                  {dating ? 'Back to scanning' : 'Enter dates'}
                </button>
                <button
                  type="button"
                  className="jmsd-action jmsd-action--primary"
                  disabled={saving || cases.length === 0 || undated > 0}
                  title={undated > 0 ? 'Every case needs its date first' : undefined}
                  onClick={() => void checkOut()}
                >
                  {saving ? 'Checking out…' : 'Check out'}
                </button>
              </>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  )
}
