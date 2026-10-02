'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { KIOSK_FLAVORS, flavorsForUpc, type KioskFlavor } from '@/lib/kiosk/catalog'
import { dealLabel, formatCents, nextJarHint, quoteJars, type KioskQuote } from '@/lib/kiosk/pricing'
import { createScanBuffer } from '@/lib/kiosk/scanner'
import { cardReader, kioskAuthHeaders, printKioskReceipt, takeCardPayment } from '@/lib/kiosk/bridge'
import { DONE_RESET_SECONDS, IDLE_RESET_MS, type KioskFilter } from './kiosk-data'
import {
  CartScreen,
  DetailModal,
  DoneScreen,
  MenuScreen,
  OrderPanel,
  PayScreen,
  PortraitBar,
  SplashScreen,
  Toast,
  chipsText,
  type CartLine,
  type PayPhase,
} from './KioskScreens'

type Screen = 'splash' | 'menu' | 'cart' | 'pay' | 'done'

interface Payment {
  phase: PayPhase
  /** `terminal`: a Square Terminal checkout id. `reader`: the order id the iPad's reader pays. */
  method: 'terminal' | 'reader'
  checkoutId: string | null
  orderNumber: string | null
  quote: KioskQuote
  error: string | null
}

interface Done {
  orderNumber: string
  lines: CartLine[]
  quote: KioskQuote
  printNote: string | null
  startedAt: number
}

const POLL_MS = 2000

/** The server answered with an error, as opposed to the request never arriving. */
class KioskHttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function kioskFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...kioskAuthHeaders(), ...init?.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new KioskHttpError(body.error ?? `Request failed (${response.status})`, response.status)
  return body as T
}

/** The kiosk is drawn at 1920×1080 (or 1080×1920 standing up) and scaled to fit the tablet. */
function useStage() {
  const [stage, setStage] = useState<{ portrait: boolean; scale: number } | null>(null)
  useEffect(() => {
    const measure = () => {
      const portrait = window.innerHeight > window.innerWidth
      const [w, h] = portrait ? [1080, 1920] : [1920, 1080]
      setStage({ portrait, scale: Math.min(window.innerWidth / w, window.innerHeight / h) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])
  return stage
}

export function KioskApp() {
  const stage = useStage()
  const [screen, setScreen] = useState<Screen>('splash')
  const [cart, setCart] = useState<Record<string, number>>({})
  const [filter, setFilter] = useState<KioskFilter>('all')
  const [detail, setDetail] = useState<{ key: string; qty: number } | null>(null)
  const [catalog, setCatalog] = useState<Record<string, { available: boolean; inStock: boolean }> | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [done, setDone] = useState<Done | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [toast, setToast] = useState<string | null>(null)
  const lastTouch = useRef(Date.now())
  // One id per payment attempt, reused only when a request got no answer (see startPayment).
  const attemptRef = useRef<string | null>(null)

  /* ---- catalog: which flavors this kiosk can sell ---- */
  const loadCatalog = useCallback(async () => {
    try {
      const data = await kioskFetch<{ flavors: Array<{ key: string; available: boolean; inStock: boolean }>; unmatched: string[] }>('/api/kiosk/catalog')
      setCatalog(Object.fromEntries(data.flavors.map((f) => [f.key, f])))
      setCatalogError(null)
      if (data.unmatched.length) console.warn('[kiosk] Flavors with no matching product:', data.unmatched)
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : 'Kiosk is offline')
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
    const timer = setInterval(() => void loadCatalog(), 60_000)
    return () => clearInterval(timer)
  }, [loadCatalog])

  const flavors = useMemo(() => KIOSK_FLAVORS.filter((f) => catalog?.[f.key]?.available), [catalog])
  const soldOut = useMemo(() => new Set(flavors.filter((f) => !catalog?.[f.key]?.inStock).map((f) => f.key)), [flavors, catalog])

  /* ---- cart ---- */
  const lines: CartLine[] = useMemo(
    () => Object.entries(cart).flatMap(([key, qty]) => {
      const flavor = KIOSK_FLAVORS.find((f) => f.key === key)
      return flavor ? [{ flavor, qty }] : []
    }),
    [cart]
  )
  const jars = lines.reduce((sum, l) => sum + l.qty, 0)
  const quote = useMemo(() => quoteJars(jars), [jars])
  const hint = nextJarHint(jars)

  const bump = useCallback((key: string, n: number) => {
    attemptRef.current = null
    setCart((c) => {
      const next = { ...c, [key]: Math.max(0, (c[key] ?? 0) + n) }
      if (!next[key]) delete next[key]
      return next
    })
  }, [])

  const reset = useCallback(() => {
    attemptRef.current = null
    setScreen('splash')
    setCart({})
    setFilter('all')
    setDetail(null)
    setPayment(null)
    setDone(null)
    void loadCatalog()
  }, [loadCatalog])

  const flash = useCallback((text: string) => {
    setToast(text)
    setTimeout(() => setToast((t) => (t === text ? null : t)), 3500)
  }, [])

  /* ---- clock: done-screen countdown and idle reset ---- */
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (screen === 'done' && done && now - done.startedAt >= DONE_RESET_SECONDS * 1000) reset()
    if ((screen === 'menu' || screen === 'cart') && now - lastTouch.current > IDLE_RESET_MS) reset()
  }, [now, screen, done, reset])

  useEffect(() => {
    const touched = () => {
      lastTouch.current = Date.now()
    }
    window.addEventListener('pointerdown', touched)
    window.addEventListener('keydown', touched)
    return () => {
      window.removeEventListener('pointerdown', touched)
      window.removeEventListener('keydown', touched)
    }
  }, [])

  /* ---- USB barcode scanner ---- */
  const scanState = useRef({ screen, flavors, soldOut })
  scanState.current = { screen, flavors, soldOut }

  useEffect(() => {
    const feed = createScanBuffer()
    const onKey = (event: KeyboardEvent) => {
      const code = feed(event.key, event.timeStamp)
      if (!code) return
      // The scan's closing Enter must not also press whatever button was last tapped.
      event.preventDefault()
      const { screen: current, flavors: sellable, soldOut: out } = scanState.current
      if (current === 'pay' || current === 'done') return
      const matches = flavorsForUpc(code)
      const sellableMatches = matches.filter((m) => sellable.some((f) => f.key === m.key))
      if (matches.length === 0) return flash("We don't recognize that barcode.")
      if (matches.length > 1) return flash(`That barcode could be ${matches.map((m) => m.name).join(' or ')}. Tap your jar instead.`)
      const flavor = matches[0]
      if (!sellableMatches.length) return flash(`${flavor.name} isn't sold at this kiosk.`)
      if (out.has(flavor.key)) return flash(`Sorry, ${flavor.name} is sold out.`)
      bump(flavor.key, 1)
      setDetail(null)
      if (current === 'splash') setScreen('menu')
      flash(`Added ${flavor.name}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bump, flash])

  /* ---- payment ---- */
  const finish = useCallback((orderNumber: string, paidQuote: KioskQuote, paidLines: CartLine[]) => {
    const receiptLines = paidLines.map(({ flavor, qty }) => ({ name: flavor.name, qty, total: formatCents(qty * 1000) }))
    const adjustments = [
      ...(paidQuote.savingsCents ? [{ label: dealLabel(paidQuote.deals), amount: `-${formatCents(paidQuote.savingsCents)}` }] : []),
      ...(paidQuote.freeChips ? [{ label: chipsText(paidQuote.freeChips), amount: 'FREE' }] : []),
    ]
    const printError = printKioskReceipt({
      orderNumber,
      dateText: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      lines: receiptLines,
      subtotal: formatCents(paidQuote.listCents),
      adjustments,
      tax: '$0.00',
      total: formatCents(paidQuote.totalCents),
      payment: 'Card - Square Terminal',
      footer: ['Gracias from the Salsa Kings!', 'josemadrid.net'],
    })
    setDone({
      orderNumber,
      lines: paidLines,
      quote: paidQuote,
      printNote: printError ? 'Ask a team member for your receipt' : null,
      startedAt: Date.now(),
    })
    if (printError) console.warn('[kiosk] Receipt not printed:', printError)
    attemptRef.current = null
    setPayment(null)
    setScreen('done')
  }, [])

  /**
   * The iPad's Square Reader takes the card with Square's own payment screen. Whatever it
   * reports, the server asks Square before the order counts as paid, and a cancel is checked
   * against Square too, so a card that did go through is never dropped.
   */
  const payOnReader = useCallback(
    async (orderId: string, orderNumber: string, paidQuote: KioskQuote) => {
      const card = await takeCardPayment({ amountCents: paidQuote.totalCents, referenceId: orderId, note: `Kiosk order ${orderNumber}` })
      const fail = (message: string) => {
        setPayment((p) => (p ? { ...p, phase: 'failed', error: message } : p))
        void loadCatalog()
      }
      try {
        if (card.status === 'paid') {
          const { status } = await kioskFetch<{ status: string }>(`/api/kiosk/checkout/reader/${orderId}`, {
            method: 'POST',
            body: JSON.stringify({ paymentId: card.paymentId }),
          })
          if (status === 'COMPLETED') return finish(orderNumber, paidQuote, lines)
          return fail('The payment could not be confirmed. Please ask a team member.')
        }
        const { status } = await kioskFetch<{ status: string }>(`/api/kiosk/checkout/reader/${orderId}/cancel`, { method: 'POST' })
        if (status === 'COMPLETED') return finish(orderNumber, paidQuote, lines)
        attemptRef.current = null
        if (card.status === 'canceled') {
          setPayment(null)
          setScreen(stage?.portrait ? 'cart' : 'menu')
          return
        }
        fail(card.error)
      } catch (error) {
        // The card may have been charged; keep the attempt so "Try again" finds this order.
        fail(error instanceof Error ? `${error.message} Please ask a team member before paying again.` : 'Please ask a team member.')
      }
    },
    [finish, lines, loadCatalog, stage?.portrait]
  )

  const startPayment = useCallback(async () => {
    if (!jars) return
    // A paired Square Reader takes the card on the iPad itself; otherwise the Square Terminal does.
    const method: Payment['method'] = cardReader() ? 'reader' : 'terminal'
    setToast(null)
    setScreen('pay')
    setPayment({ phase: 'starting', method, checkoutId: null, orderNumber: null, quote, error: null })
    attemptRef.current ??= crypto.randomUUID()
    try {
      const result = await kioskFetch<{ checkoutId: string; orderNumber: string; quote: KioskQuote; alreadyPaid: boolean }>('/api/kiosk/checkout', {
        method: 'POST',
        body: JSON.stringify({ items: lines.map((l) => ({ key: l.flavor.key, quantity: l.qty })), attemptId: attemptRef.current, method }),
      })
      // A retry that finds the customer already paid goes straight to the receipt.
      if (result.alreadyPaid) return finish(result.orderNumber, result.quote, lines)
      setPayment({ phase: 'waiting', method, checkoutId: result.checkoutId, orderNumber: result.orderNumber, quote: result.quote, error: null })
      if (method === 'reader') return payOnReader(result.checkoutId, result.orderNumber, result.quote)
    } catch (error) {
      // Only a definite refusal (bad cart, sold out, not paired) proves nothing reached the
      // Terminal, so only then is a retry a new attempt. No answer, "still starting" (409) or
      // a server error may mean the checkout exists, so "Try again" reuses the id to find it.
      if (error instanceof KioskHttpError && error.status < 500 && error.status !== 409) attemptRef.current = null
      setPayment({ phase: 'failed', method, checkoutId: null, orderNumber: null, quote, error: error instanceof Error ? error.message : 'Payment failed' })
      void loadCatalog()
    }
  }, [jars, lines, quote, loadCatalog, finish, payOnReader])

  const cancelPayment = useCallback(async () => {
    // On the reader, Square's own payment screen has the cancel button.
    if (!payment?.checkoutId || payment.method === 'reader') return
    setPayment({ ...payment, phase: 'canceling' })
    try {
      const { status } = await kioskFetch<{ status: string }>(`/api/kiosk/checkout/${payment.checkoutId}/cancel`, { method: 'POST' })
      // The card may have gone through just before the cancel landed.
      if (status === 'COMPLETED' && payment.orderNumber) return finish(payment.orderNumber, payment.quote, lines)
      if (status === 'CANCELED' || status === 'FAILED') {
        attemptRef.current = null
        setPayment(null)
        setScreen(stage?.portrait ? 'cart' : 'menu')
        return
      }
      // Cancel requested but not yet done on the Terminal: keep watching it.
      setPayment({ ...payment, phase: 'waiting' })
    } catch (error) {
      setPayment({ ...payment, phase: 'waiting', error: error instanceof Error ? error.message : null })
    }
  }, [payment, finish, lines, stage?.portrait])

  const paymentRef = useRef(payment)
  paymentRef.current = payment
  const checkoutId = payment?.phase === 'waiting' && payment.method === 'terminal' ? payment.checkoutId : null
  useEffect(() => {
    if (!checkoutId) return
    let stopped = false
    const poll = async () => {
      try {
        const { status } = await kioskFetch<{ status: string }>(`/api/kiosk/checkout/${checkoutId}`)
        if (stopped) return
        if (status === 'COMPLETED') {
          stopped = true
          const paid = paymentRef.current
          if (paid?.orderNumber) finish(paid.orderNumber, paid.quote, lines)
        } else if (status === 'CANCELED' || status === 'FAILED') {
          stopped = true
          attemptRef.current = null
          setPayment((p) => (p ? { ...p, phase: 'failed', error: 'The card reader canceled the payment.' } : p))
          void loadCatalog()
        }
      } catch (error) {
        // A dropped poll is not a failed payment; keep asking.
        console.warn('[kiosk] Status check failed:', error)
      }
    }
    const timer = setInterval(() => void poll(), POLL_MS)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [checkoutId, finish, lines, loadCatalog])

  if (!stage) return null

  const { portrait, scale } = stage
  const [w, h] = portrait ? [1080, 1920] : [1920, 1080]
  const detailFlavor: KioskFlavor | undefined = detail ? KIOSK_FLAVORS.find((f) => f.key === detail.key) : undefined
  const backToOrder = () => {
    setPayment(null)
    setScreen(portrait ? 'cart' : 'menu')
  }

  return (
    <div className="absolute left-1/2 top-1/2 overflow-hidden" style={{ width: w, height: h, transform: `translate(-50%, -50%) scale(${scale})` }}>
      {screen === 'splash' && (
        <SplashScreen portrait={portrait} flavorCount={KIOSK_FLAVORS.length} jars={KIOSK_FLAVORS} onStart={() => setScreen('menu')}
          notice={catalogError ? `Staff: ${catalogError}` : null} />
      )}

      {screen === 'menu' && (
        <MenuScreen
          portrait={portrait}
          flavors={flavors}
          soldOut={soldOut}
          cart={cart}
          filter={filter}
          onFilter={setFilter}
          onPick={(key) => setDetail({ key, qty: 1 })}
          onReset={reset}
          orderPanel={portrait ? null : (
            <OrderPanel lines={lines} quote={quote} hint={hint} onPay={() => void startPayment()} onInc={(k) => bump(k, 1)} onDec={(k) => bump(k, -1)} />
          )}
          bottomBar={portrait ? <PortraitBar lines={lines} quote={quote} onReview={() => jars && setScreen('cart')} /> : null}
        />
      )}

      {screen === 'cart' && (
        <CartScreen lines={lines} quote={quote} hint={hint} onBack={() => setScreen('menu')} onPay={() => void startPayment()} onInc={(k) => bump(k, 1)} onDec={(k) => bump(k, -1)} />
      )}

      {screen === 'pay' && payment && (
        <PayScreen phase={payment.phase} quote={payment.quote} error={payment.error} onCancel={() => void cancelPayment()} onRetry={() => void startPayment()} onBack={backToOrder} />
      )}

      {screen === 'done' && done && (
        <DoneScreen portrait={portrait} orderNumber={done.orderNumber} lines={done.lines} quote={done.quote}
          secondsLeft={Math.min(DONE_RESET_SECONDS, Math.max(0, DONE_RESET_SECONDS - Math.floor((now - done.startedAt) / 1000)))} printNote={done.printNote} onNewOrder={reset} />
      )}

      {screen === 'menu' && detailFlavor && detail && (
        <DetailModal portrait={portrait} flavor={detailFlavor} qty={detail.qty}
          onDec={() => setDetail({ ...detail, qty: Math.max(1, detail.qty - 1) })}
          onInc={() => setDetail({ ...detail, qty: Math.min(24, detail.qty + 1) })}
          onClose={() => setDetail(null)}
          onAdd={() => {
            bump(detail.key, detail.qty)
            setDetail(null)
          }} />
      )}

      {toast && <Toast text={toast} />}
    </div>
  )
}
