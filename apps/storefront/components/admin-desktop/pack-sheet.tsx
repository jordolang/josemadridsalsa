'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PackOrder } from '@/lib/admin-desktop/fulfil'
import { isPacked, packedUnits, packScan, unpack, type PackLine } from '@/lib/admin-desktop/pack'
import { Icon } from './icons'

type Stage = 'find' | 'scan' | 'buying' | 'done'

interface BoughtLabel {
  trackingNumber: string
  labelUrl: string | null
  carrier: string
  service: string
  cost: number
}

/**
 * A short tone, so a packer working with their eyes on the box hears a wrong
 * jar. Best effort: a window that cannot make sound still shows the message.
 */
function beep(good: boolean) {
  try {
    const context = new AudioContext()
    const tone = context.createOscillator()
    const gain = context.createGain()
    tone.frequency.value = good ? 880 : 220
    gain.gain.value = 0.08
    tone.connect(gain).connect(context.destination)
    tone.start()
    tone.stop(context.currentTime + (good ? 0.08 : 0.35))
    tone.onended = () => void context.close()
  } catch {
    // No audio device, or the window has not been interacted with yet.
  }
}

async function fetchOrder(reference: string): Promise<PackOrder | string> {
  try {
    const response = await fetch(`/api/admin/desktop/pack?order=${encodeURIComponent(reference)}`, {
      credentials: 'same-origin',
    })
    const body = (await response.json()) as { order?: PackOrder; error?: string }
    if (response.status === 403) return 'Your account cannot read orders.'
    return body.order ?? body.error ?? 'Could not load that order.'
  } catch {
    return 'Could not reach the server. Check the connection and try again.'
  }
}

/** Send the label and the packing slip to the printers, or open them in a browser tab. */
function printShipment(labelUrl: string | null, order: PackOrder) {
  const bridge = window.jmsDesktop
  if (labelUrl) {
    if (bridge?.printLabel) bridge.printLabel(labelUrl)
    else window.open(labelUrl, '_blank', 'noopener')
  }
  if (bridge?.printDocument) bridge.printDocument(order.slipHtml)
  else window.open(`/admin/orders/${order.id}/packing-slip`, '_blank', 'noopener')
}

/**
 * Pack and ship one order with the barcode scanner.
 *
 * Scan the order ticket (or type its number), then scan every jar into the
 * box. Each scan ticks a unit off its line; a jar that is not on the order, or
 * one too many, is refused with a low tone. When the last unit is scanned the
 * postage is bought — the cheapest rate for the parcel the order's own items
 * make, through the same route as the order page's label button — and the
 * label and packing slip print. Nothing is bought until every jar is scanned.
 */
export function PackSheet({
  orderId,
  onClose,
  onShipped,
}: {
  orderId?: string
  onClose: () => void
  onShipped: (message: string) => void
}) {
  const [stage, setStage] = useState<Stage>('find')
  const [order, setOrder] = useState<PackOrder | null>(null)
  const [lines, setLines] = useState<PackLine[]>([])
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<{ text: string; bad: boolean } | null>(null)
  const [bought, setBought] = useState<BoughtLabel | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const shippedAny = useRef(false)

  const open = useCallback(async (reference: string) => {
    setBusy(true)
    const result = await fetchOrder(reference)
    setBusy(false)
    if (typeof result === 'string') {
      beep(false)
      setLast({ text: result, bad: true })
      return
    }
    setOrder(result)
    setLines(result.lines)
    setBought(null)
    setBuyError(null)
    setStage(result.blocked || result.label ? 'done' : 'scan')
    setLast(
      result.blocked
        ? { text: result.blocked, bad: true }
        : result.label
          ? { text: `${result.orderNumber} already has postage (${result.label.trackingNumber}).`, bad: true }
          : { text: `${result.orderNumber} for ${result.customerName}. Scan each jar.`, bad: false },
    )
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (orderId) void open(orderId)
  }, [orderId, open])

  const buy = useCallback(async (target: PackOrder) => {
    setStage('buying')
    setBuyError(null)
    setLast({ text: 'Every jar is in. Buying postage…', bad: false })
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(target.id)}/shipping-label`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const body = (await response.json()) as { label?: BoughtLabel; error?: string }
      if (!response.ok || !body.label) throw new Error(body.error ?? 'The label could not be bought.')

      // Read the order again so the packing slip carries the tracking number.
      const fresh = await fetchOrder(target.id)
      const shipped = typeof fresh === 'string' ? target : fresh
      setOrder(shipped)
      setBought(body.label)
      setStage('done')
      shippedAny.current = true
      printShipment(body.label.labelUrl, shipped)
      beep(true)
      setLast({ text: `${target.orderNumber} shipped · ${body.label.carrier} ${body.label.service} · ${body.label.trackingNumber}`, bad: false })
    } catch (error) {
      beep(false)
      setStage('scan')
      setBuyError(error instanceof Error ? error.message : 'The label could not be bought.')
      setLast({ text: 'Postage was not bought. Nothing was charged.', bad: true })
    }
    inputRef.current?.focus()
  }, [])

  function submit() {
    const typed = code.trim()
    setCode('')
    if (!typed || busy) return

    if (stage === 'find' || stage === 'done') {
      void open(typed)
      return
    }
    if (stage !== 'scan' || !order) return

    const { lines: next, outcome } = packScan(lines, typed)
    if (outcome.kind === 'packed') {
      setLines(next)
      beep(true)
      const left = outcome.line.quantity - outcome.line.packed
      setLast({ text: `${outcome.line.name} · ${left === 0 ? 'line done' : `${left} more`}`, bad: false })
      if (isPacked(next)) void buy(order)
      return
    }
    // Nothing scanned into this box yet, and the code is not a jar: most likely
    // the next order's ticket, so open that instead.
    if (outcome.kind === 'unknown' && packedUnits(lines).packed === 0) {
      void open(typed)
      return
    }
    beep(false)
    setLast(
      outcome.kind === 'extra'
        ? { text: `Too many ${outcome.line.name} — the order has ${outcome.line.quantity}. Take one out.`, bad: true }
        : { text: `${typed} is not on order ${order.orderNumber}. Take it out of the box.`, bad: true },
    )
  }

  const close = () => (shippedAny.current ? onShipped('Shipping labels bought and printed') : onClose())
  const { packed, total } = packedUnits(lines)

  return (
    <div className="jmsd-scrim" role="presentation" onMouseDown={stage === 'buying' ? undefined : close}>
      <div
        className="jmsd-sheet jmsd-sheet--regular"
        role="dialog"
        aria-modal="true"
        aria-label="Pack and ship"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && stage !== 'buying') close()
        }}
      >
        <header className="jmsd-sheet-head">
          <div className="jmsd-sheet-heading">
            <div className="jmsd-sheet-title">{order ? `Pack ${order.orderNumber}` : 'Pack and ship'}</div>
            <div className="jmsd-sheet-subtitle">
              {order
                ? [order.customerName, ...order.address].join(' · ')
                : 'Scan the order ticket, or type the order number, then scan every jar into the box. Postage is bought and the label and packing slip print once the last jar is scanned.'}
            </div>
          </div>
          <button type="button" className="jmsd-icon-button" onClick={close} disabled={stage === 'buying'} aria-label="Close">
            <Icon name="i-close" size={14} />
          </button>
        </header>

        <div className="jmsd-sheet-body">
          <input
            ref={inputRef}
            autoFocus
            className="jmsd-input jmsd-scan-input"
            value={code}
            disabled={busy || stage === 'buying'}
            placeholder={stage === 'scan' ? 'Scan a jar' : 'Scan an order ticket, or type the order number'}
            aria-label="Barcode"
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              submit()
            }}
          />

          {last ? (
            <div className={`jmsd-scan-last ${last.bad ? 'jmsd-tone-bad' : 'jmsd-tone-good'}`} role="status">
              {last.text}
            </div>
          ) : null}
          {buyError ? <div className="jmsd-sheet-error">{buyError}</div> : null}

          {order && lines.length > 0 ? (
            <table className="jmsd-scan-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th className="jmsd-cell--right">Ordered</th>
                  <th className="jmsd-cell--right">Scanned</th>
                  <th aria-label="Adjust" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className={line.packed >= line.quantity ? 'jmsd-tone-good' : undefined}>
                    <td>
                      {line.name}
                      {!line.barcode ? <div className="jmsd-field-help">No barcode on file — type the SKU</div> : null}
                    </td>
                    <td className="jmsd-mono">{line.sku}</td>
                    <td className="jmsd-cell--right jmsd-mono">{line.quantity}</td>
                    <td className="jmsd-cell--right jmsd-mono">{line.packed}</td>
                    <td className="jmsd-scan-adjust">
                      <button
                        type="button"
                        className="jmsd-chip"
                        aria-label={`One fewer ${line.name}`}
                        disabled={stage !== 'scan' || line.packed === 0}
                        onClick={() => {
                          setLines((previous) => unpack(previous, line.id))
                          inputRef.current?.focus()
                        }}
                      >
                        −
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {bought ? (
            <div className="jmsd-field-help">
              {bought.carrier} {bought.service} · ${bought.cost.toFixed(2)} · tracking {bought.trackingNumber}. Scan the
              next order ticket to keep going.
            </div>
          ) : null}
        </div>

        <footer className="jmsd-sheet-foot">
          <span className="jmsd-field-help">{order ? `${packed} of ${total} scanned` : ''}</span>
          <div className="jmsd-sheet-buttons">
            {order && stage === 'done' && (bought || order.label) ? (
              <button
                type="button"
                className="jmsd-action"
                onClick={() => {
                  printShipment(bought?.labelUrl ?? order.label?.labelUrl ?? null, order)
                  inputRef.current?.focus()
                }}
              >
                Print label and slip again
              </button>
            ) : null}
            {order && stage === 'scan' && buyError && isPacked(lines) ? (
              <button type="button" className="jmsd-action jmsd-action--primary" onClick={() => void buy(order)}>
                Try buying postage again
              </button>
            ) : null}
            <button type="button" className="jmsd-action" onClick={close} disabled={stage === 'buying'}>
              {stage === 'buying' ? 'Buying postage…' : 'Done'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
