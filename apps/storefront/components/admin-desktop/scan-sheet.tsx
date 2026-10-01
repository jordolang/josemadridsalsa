'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DesktopCommand } from '@/lib/admin-desktop/types'
import {
  findByCode,
  resultingCount,
  tallyWrites,
  type ScanMode,
  type ScanProduct,
} from '@/lib/admin-desktop/scan'
import { Icon } from './icons'

type WriteCommand = Extract<DesktopCommand, { kind: 'write' }>
type WriteResult = { message: string } | { error: string }

/**
 * Count or receive stock with a barcode scanner.
 *
 * The scanner types into the box and presses Enter; each scan adds one to that
 * product's tally. Nothing is written until **Apply**, which sends one
 * `inventory.adjust` per product — so a miscount is fixed with − and + first,
 * and every change lands in the inventory log with its reason. Typing a SKU and
 * pressing Enter works too, for a jar whose label will not scan.
 */
export function ScanSheet({
  postWrite,
  onClose,
  onApplied,
}: {
  postWrite: (command: WriteCommand) => Promise<WriteResult>
  onClose: () => void
  onApplied: (message: string) => void
}) {
  const [products, setProducts] = useState<ScanProduct[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [mode, setMode] = useState<ScanMode>('count')
  const [tally, setTally] = useState<ReadonlyMap<string, number>>(() => new Map())
  const [code, setCode] = useState('')
  const [last, setLast] = useState<{ text: string; bad: boolean } | null>(null)
  const [applying, setApplying] = useState(false)
  const [failures, setFailures] = useState<Record<string, string>>({})
  /** A first Cancel with scans in hand asks; a second one discards. */
  const [discarding, setDiscarding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let live = true
    fetch('/api/admin/desktop/scan', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 403 ? 'Your account cannot read inventory.' : 'Could not load the catalogue.')
        const body = (await response.json()) as { products: ScanProduct[] }
        if (live) setProducts(body.products)
      })
      .catch((error: unknown) => {
        if (live) setLoadError(error instanceof Error ? error.message : 'Could not load the catalogue.')
      })
    return () => {
      live = false
    }
  }, [])

  const byId = useMemo(() => new Map((products ?? []).map((product) => [product.id, product])), [products])
  const withBarcode = products?.filter((product) => product.barcode).length ?? 0
  const lines = [...tally].flatMap(([id, scanned]) => {
    const product = byId.get(id)
    return product ? [{ product, scanned }] : []
  })
  const jars = lines.reduce((sum, line) => sum + line.scanned, 0)

  const bump = (id: string, by: number) =>
    setTally((previous) => {
      const next = new Map(previous)
      next.set(id, Math.max(0, (next.get(id) ?? 0) + by))
      return next
    })

  const remove = (id: string) =>
    setTally((previous) => {
      const next = new Map(previous)
      next.delete(id)
      return next
    })

  function scan() {
    const typed = code
    setCode('')
    if (!typed.trim() || !products) return
    const product = findByCode(products, typed)
    if (!product) {
      setLast({ text: `No product has the code ${typed.trim()}`, bad: true })
      return
    }
    bump(product.id, 1)
    setLast({ text: `${product.name} · ${(tally.get(product.id) ?? 0) + 1} scanned`, bad: false })
  }

  async function apply() {
    const writes = tallyWrites(mode, tally)
    if (writes.length === 0 || applying) return
    setApplying(true)
    const failed: Record<string, string> = {}
    for (const command of writes) {
      const result = await postWrite(command)
      if ('error' in result && command.recordId) failed[command.recordId] = result.error
    }
    setApplying(false)

    const done = writes.length - Object.keys(failed).length
    if (Object.keys(failed).length === 0) {
      onApplied(`${mode === 'count' ? 'Count' : 'Receipt'} applied to ${done} ${done === 1 ? 'product' : 'products'}`)
      return
    }
    // Keep only what did not go through, so applying again cannot double a receipt.
    setTally((previous) => new Map([...previous].filter(([id]) => id in failed)))
    setFailures(failed)
    setLast({ text: `${done} applied, ${Object.keys(failed).length} failed — fix and apply again`, bad: true })
  }

  // Not window.confirm: the macOS window draws no JavaScript dialogs, so it
  // would answer "no" without asking and the sheet could never be closed.
  const close = () => {
    if (tally.size > 0 && !discarding) {
      setDiscarding(true)
      setLast({ text: `Cancel again to discard ${jars} scanned ${jars === 1 ? 'jar' : 'jars'}`, bad: true })
      return
    }
    onClose()
  }

  return (
    <div className="jmsd-scrim" role="presentation" onMouseDown={close}>
      <div
        className="jmsd-sheet jmsd-sheet--regular"
        role="dialog"
        aria-modal="true"
        aria-label="Scan stock"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape') close()
        }}
      >
        <header className="jmsd-sheet-head">
          <div className="jmsd-sheet-heading">
            <div className="jmsd-sheet-title">Scan stock</div>
            <div className="jmsd-sheet-subtitle">
              {mode === 'count'
                ? 'Scan every jar on the shelf. Each product you scan is set to the number scanned; anything not scanned is left alone.'
                : 'Scan every jar that arrived. Each scan adds one to that product.'}
            </div>
          </div>
          <button type="button" className="jmsd-icon-button" onClick={close} aria-label="Close">
            <Icon name="i-close" size={14} />
          </button>
        </header>

        <div className="jmsd-sheet-body">
          <div className="jmsd-scan-modes" role="group" aria-label="What the scans mean">
            {(['count', 'receive'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className="jmsd-chip"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value)
                  inputRef.current?.focus()
                }}
              >
                {value === 'count' ? 'Stock count' : 'Receiving'}
              </button>
            ))}
          </div>

          <input
            ref={inputRef}
            autoFocus
            className="jmsd-input jmsd-scan-input"
            value={code}
            disabled={!products || applying}
            placeholder={products ? 'Scan a barcode, or type a SKU and press Enter' : 'Loading the catalogue…'}
            aria-label="Barcode"
            onChange={(event) => {
              setCode(event.target.value)
              setDiscarding(false)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              scan()
            }}
          />

          {loadError ? <div className="jmsd-sheet-error">{loadError}</div> : null}
          {last ? (
            <div className={`jmsd-scan-last ${last.bad ? 'jmsd-tone-bad' : 'jmsd-tone-good'}`} role="status">
              {last.text}
            </div>
          ) : null}
          {products && withBarcode === 0 ? (
            <div className="jmsd-field-help">
              No product has a barcode yet — add them on each product&apos;s edit sheet. Until then, type SKUs.
            </div>
          ) : null}

          {lines.length > 0 ? (
            <table className="jmsd-scan-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="jmsd-cell--right">On hand</th>
                  <th className="jmsd-cell--right">Scanned</th>
                  <th className="jmsd-cell--right">Becomes</th>
                  <th aria-label="Adjust" />
                </tr>
              </thead>
              <tbody>
                {lines.map(({ product, scanned }) => (
                  <tr key={product.id}>
                    <td>
                      {product.name}
                      {failures[product.id] ? <div className="jmsd-tone-bad">{failures[product.id]}</div> : null}
                    </td>
                    <td className="jmsd-cell--right jmsd-mono">{product.inventory}</td>
                    <td className="jmsd-cell--right jmsd-mono">{scanned}</td>
                    <td className="jmsd-cell--right jmsd-mono">{resultingCount(mode, product, scanned)}</td>
                    <td className="jmsd-scan-adjust">
                      <button type="button" className="jmsd-chip" aria-label={`One fewer ${product.name}`} onClick={() => bump(product.id, -1)}>
                        −
                      </button>
                      <button type="button" className="jmsd-chip" aria-label={`One more ${product.name}`} onClick={() => bump(product.id, 1)}>
                        +
                      </button>
                      <button type="button" className="jmsd-chip" aria-label={`Remove ${product.name}`} onClick={() => remove(product.id)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>

        <footer className="jmsd-sheet-foot">
          <span className="jmsd-field-help">
            {lines.length} {lines.length === 1 ? 'product' : 'products'} · {jars} {jars === 1 ? 'jar' : 'jars'}
          </span>
          <div className="jmsd-sheet-buttons">
            <button type="button" className="jmsd-action" onClick={close} disabled={applying}>
              {discarding ? 'Discard scans' : 'Cancel'}
            </button>
            <button
              type="button"
              className="jmsd-action jmsd-action--primary"
              onClick={() => void apply()}
              disabled={applying || lines.length === 0}
            >
              {applying ? 'Applying…' : mode === 'count' ? 'Apply count' : 'Add to stock'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
