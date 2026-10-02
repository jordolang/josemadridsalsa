'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  Plus,
  Minus,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Printer,
  RotateCcw,
  CreditCard,
  Banknote,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils'

// --- Types ---

interface POSCartItem {
  id: string
  name: string
  sku: string
  price: number
  quantity: number
}

interface POSProduct {
  id: string
  name: string
  sku: string
  price: number
  heatLevel: string
}

type PaymentMethod = 'card' | 'cash'

type CheckoutStatus =
  | 'idle'
  | 'selecting_payment'
  | 'cash_tendered'
  | 'creating'
  | 'waiting_for_terminal'
  | 'success'
  | 'failed'
  | 'timeout'

interface CheckoutState {
  status: CheckoutStatus
  paymentMethod: PaymentMethod | null
  checkoutId: string | null
  orderNumber: string | null
  cashTendered: number | null
  changeAmount: number | null
  /** One per cash payment, reused on retry so a lost response can't record the sale twice. */
  attemptId: string | null
  error: string | null
}

const INITIAL_CHECKOUT_STATE: CheckoutState = {
  status: 'idle',
  paymentMethod: null,
  checkoutId: null,
  orderNumber: null,
  cashTendered: null,
  changeAmount: null,
  attemptId: null,
  error: null,
}

const HEAT_COLORS: Record<string, string> = {
  Mild: 'bg-green-100 text-green-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hot: 'bg-red-100 text-red-800',
  Variety: 'bg-purple-100 text-purple-800',
}

const POLL_INTERVAL_MS = 2000
const POLL_TIMEOUT_MS = 60_000

export default function POSPage() {
  const [products, setProducts] = useState<POSProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState(false)
  const [taxCents, setTaxCents] = useState<number | null>(0)
  const [taxError, setTaxError] = useState<string | null>(null)
  // Bumped when the server rejects a charge as stale (409), forcing a fresh tax quote
  // so Retry doesn't resubmit the same outdated total.
  const [taxQuoteVersion, setTaxQuoteVersion] = useState(0)
  const [cart, setCart] = useState<POSCartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [barcodeBuffer, setBarcodeBuffer] = useState('')
  const [checkout, setCheckout] = useState<CheckoutState>(INITIAL_CHECKOUT_STATE)
  const barcodeInputRef = useRef<HTMLInputElement>(null)
  const lastKeystrokeRef = useRef<number>(0)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollStartRef = useRef<number>(0)

  // Fetch products from API on mount
  useEffect(() => {
    let cancelled = false
    async function loadProducts() {
      try {
        const res = await fetch('/api/products?limit=100')
        if (!res.ok) {
          if (!cancelled) setProductsError(true)
          return
        }
        const data = await res.json()
        const items: unknown[] = Array.isArray(data) ? data : data.data ?? data.products ?? []
        if (!cancelled && items.length > 0) {
          setProducts(
            items.map((p: unknown) => {
              const product = p as Record<string, unknown>
              return {
                id: String(product.id ?? ''),
                name: String(product.name ?? ''),
                sku: String(product.sku ?? ''),
                price: Number(product.price ?? 0),
                heatLevel: String(product.heatLevel ?? product.heat_level ?? 'Other'),
              }
            })
          )
        }
      } catch {
        if (!cancelled) setProductsError(true)
      } finally {
        if (!cancelled) setProductsLoading(false)
      }
    }
    loadProducts()
    return () => { cancelled = true }
  }, [])

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current)
      }
    }
  }, [])

  // Auto-focus the barcode input when idle
  useEffect(() => {
    if (checkout.status === 'idle') {
      barcodeInputRef.current?.focus()
    }
  }, [cart, checkout.status])

  // Barcode scanner detection: rapid keystrokes ending with Enter
  const handleBarcodeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const now = Date.now()
      const timeSinceLastKeystroke = now - lastKeystrokeRef.current
      lastKeystrokeRef.current = now

      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        e.preventDefault()
        const product = products.find(
          (p) => p.sku.toLowerCase() === barcodeBuffer.toLowerCase()
        )
        if (product) {
          addToCart(product)
        }
        setBarcodeBuffer('')
        return
      }

      if (timeSinceLastKeystroke > 100 && barcodeBuffer.length > 0) {
        setBarcodeBuffer('')
      }
    },
    [barcodeBuffer, products]
  )

  function addToCart(product: POSProduct) {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          sku: product.sku,
          price: product.price,
          quantity: 1,
        },
      ]
    })
  }

  function updateQuantity(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((item) => item.id !== id))
  }

  function clearCart() {
    setCart([])
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const tax = (taxCents ?? 0) / 100
  const total = subtotal + tax
  const taxReady = taxCents !== null && !taxError

  // Live tax line from Stripe Tax at the store address; the server recomputes it at charge time.
  useEffect(() => {
    if (cart.length === 0) {
      setTaxCents(0)
      setTaxError(null)
      return
    }
    setTaxCents(null)
    setTaxError(null)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/pos/tax-quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart.map((item) => ({ productId: item.id, price: item.price, quantity: item.quantity })),
          }),
          signal: controller.signal,
        })
        const data = (await res.json().catch(() => ({}))) as { taxCents?: number; error?: string }
        if (!res.ok || typeof data.taxCents !== 'number') {
          setTaxError(data.error ?? 'Could not calculate tax')
          return
        }
        setTaxCents(data.taxCents)
      } catch (error) {
        if (!controller.signal.aborted) setTaxError('Could not calculate tax')
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [cart, taxQuoteVersion])

  const filteredProducts = searchQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : products

  // --- Payment flow ---

  function handleChargeClick() {
    if (cart.length === 0 || !taxReady) return
    setCheckout({
      ...INITIAL_CHECKOUT_STATE,
      status: 'selecting_payment',
    })
  }

  function handleSelectCard() {
    setCheckout((prev) => ({
      ...prev,
      paymentMethod: 'card',
      status: 'creating',
    }))
    initiateTerminalCheckout()
  }

  function handleSelectCash() {
    setCheckout((prev) => ({
      ...prev,
      paymentMethod: 'cash',
      status: 'cash_tendered',
      attemptId: crypto.randomUUID(),
    }))
  }

  async function handleCashSubmit(tendered: number) {
    setCheckout((prev) => ({ ...prev, status: 'creating', error: null }))
    // Same cents arithmetic as the server (prices x quantity, plus the quoted tax), so its
    // total check cannot be off by a rounding cent.
    const totalCents =
      cart.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) + (taxCents ?? 0)
    try {
      const res = await fetch('/api/pos/cash-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
          total: totalCents,
          tendered: Math.round(tendered * 100),
          attemptId: checkout.attemptId,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409) setTaxQuoteVersion((v) => v + 1)
        setCheckout((prev) => ({
          ...prev,
          status: 'failed',
          error: body.error || 'Failed to record cash sale',
        }))
        return
      }
      const data = body as { orderNumber: string; changeCents: number }
      setCheckout((prev) => ({
        ...prev,
        status: 'success',
        cashTendered: tendered,
        changeAmount: data.changeCents / 100,
        orderNumber: data.orderNumber,
      }))
    } catch (err: unknown) {
      setCheckout((prev) => ({
        ...prev,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Network error while recording cash sale',
      }))
    }
  }

  async function initiateTerminalCheckout() {
    try {
      const res = await fetch('/api/pos/create-terminal-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            name: item.name,
            sku: item.sku,
            price: item.price,
            quantity: item.quantity,
          })),
          // Same cents arithmetic as the server, so the totals compare exactly.
          total:
            cart.reduce((sum, item) => sum + Math.round(item.price * 100) * item.quantity, 0) +
            (taxCents ?? 0),
          deviceId: 'default',
        }),
      })

      if (!res.ok) {
        if (res.status === 409) setTaxQuoteVersion((v) => v + 1)
        const body = await res.json().catch(() => ({ error: 'Failed to create checkout' }))
        setCheckout((prev) => ({
          ...prev,
          status: 'failed',
          error: body.error || 'Failed to create terminal checkout',
        }))
        return
      }

      const data: { checkoutId: string; orderNumber?: string } = await res.json()

      setCheckout((prev) => ({
        ...prev,
        status: 'waiting_for_terminal',
        checkoutId: data.checkoutId,
        orderNumber: data.orderNumber ?? null,
      }))

      pollStartRef.current = Date.now()
      pollTimerRef.current = setTimeout(() => {
        pollTerminalStatus(data.checkoutId)
      }, POLL_INTERVAL_MS)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Network error while creating checkout'
      setCheckout((prev) => ({
        ...prev,
        status: 'failed',
        error: message,
      }))
    }
  }

  async function pollTerminalStatus(checkoutId: string) {
    const elapsed = Date.now() - pollStartRef.current
    if (elapsed >= POLL_TIMEOUT_MS) {
      setCheckout((prev) => ({
        ...prev,
        status: 'timeout',
        error: 'Payment timed out. The terminal did not respond in time.',
      }))
      return
    }

    try {
      const res = await fetch(
        `/api/pos/terminal-status?checkoutId=${encodeURIComponent(checkoutId)}`
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to check terminal status' }))
        setCheckout((prev) => ({
          ...prev,
          status: 'failed',
          error: body.error || 'Failed to check terminal status',
        }))
        return
      }

      const data: {
        status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | 'FAILED'
        orderNumber?: string
      } = await res.json()

      if (data.status === 'COMPLETED') {
        setCheckout((prev) => ({
          ...prev,
          status: 'success',
          orderNumber: data.orderNumber ?? prev.orderNumber,
        }))
        return
      }

      if (data.status === 'CANCELED' || data.status === 'FAILED') {
        setCheckout((prev) => ({
          ...prev,
          status: 'failed',
          error:
            data.status === 'CANCELED'
              ? 'Payment was canceled on the terminal.'
              : 'Payment failed on the terminal.',
        }))
        return
      }

      pollTimerRef.current = setTimeout(() => {
        pollTerminalStatus(checkoutId)
      }, POLL_INTERVAL_MS)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Network error while checking terminal status'
      setCheckout((prev) => ({
        ...prev,
        status: 'failed',
        error: message,
      }))
    }
  }

  function handleCancelCheckout() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setCheckout(INITIAL_CHECKOUT_STATE)
  }

  function handleNewSale() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setCart([])
    setCheckout(INITIAL_CHECKOUT_STATE)
  }

  function handleRetry() {
    if (!taxReady) return
    if (checkout.paymentMethod === 'card') {
      setCheckout((prev) => ({
        ...prev,
        status: 'creating',
        error: null,
      }))
      initiateTerminalCheckout()
    } else {
      setCheckout((prev) => ({
        ...prev,
        status: 'cash_tendered',
        error: null,
      }))
    }
  }

  function handlePrintReceipt() {
    window.print()
  }

  const showOverlay = checkout.status !== 'idle'

  return (
    <div className="flex h-full">
      {/* Left side: Product grid + search */}
      <div className="flex flex-1 flex-col overflow-hidden border-r bg-white">
        {/* Barcode + search bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="relative flex-1">
            <Input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan barcode or search products..."
              value={barcodeBuffer || searchQuery}
              onChange={(e) => {
                const val = e.target.value
                setBarcodeBuffer(val)
                setSearchQuery(val)
              }}
              onKeyDown={handleBarcodeKeyDown}
              className="pl-10 text-base h-12"
              autoComplete="off"
              disabled={showOverlay}
            />
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchQuery('')
                setBarcodeBuffer('')
                barcodeInputRef.current?.focus()
              }}
              className="h-12 w-12"
              disabled={showOverlay}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {productsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading products...
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  disabled={showOverlay}
                  className="flex flex-col items-start rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition-all active:scale-95 hover:border-salsa-400 hover:shadow-md min-h-[120px] disabled:opacity-50 disabled:pointer-events-none"
                >
                  <span className="text-sm font-semibold text-slate-900 leading-tight">
                    {product.name}
                  </span>
                  <span className="mt-1 text-xs text-slate-500 font-mono">
                    {product.sku}
                  </span>
                  <div className="mt-auto flex w-full items-center justify-between pt-3">
                    <span className="text-lg font-bold text-slate-900">
                      {formatPrice(product.price)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        HEAT_COLORS[product.heatLevel] || 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {product.heatLevel}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!productsLoading && filteredProducts.length === 0 && (
            <div className="flex items-center justify-center py-16 text-slate-400">
              {productsError ? 'Could not load products. Reload the page to try again.' : 'No products found'}
            </div>
          )}
        </div>
      </div>

      {/* Right side: Cart / order summary */}
      <div className="relative flex w-[380px] flex-col bg-white lg:w-[420px]">
        {/* Cart header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">Current Sale</h2>
          {cart.length > 0 && checkout.status === 'idle' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCart}
              className="text-slate-500 hover:text-red-600"
            >
              Clear
            </Button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ShoppingCartEmpty className="h-12 w-12 mb-3" />
              <p className="text-sm">Scan or tap a product to begin</p>
            </div>
          ) : (
            <div className="divide-y">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatPrice(item.price)} each
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      disabled={showOverlay}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100 disabled:opacity-50"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-8 text-center text-sm font-semibold">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      disabled={showOverlay}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100 disabled:opacity-50"
                      aria-label={`Increase quantity of ${item.name}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <span className="w-16 text-right text-sm font-semibold text-slate-900">
                    {formatPrice(item.price * item.quantity)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    disabled={showOverlay}
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 active:bg-red-50 disabled:opacity-50"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order totals + charge button */}
        <div className="border-t bg-slate-50 p-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>{taxCents === null && !taxError ? 'Calculating…' : taxError ? '—' : formatPrice(tax)}</span>
            </div>
            {taxError && <p className="text-xs text-red-600">{taxError}</p>}
            <div className="flex justify-between border-t pt-2 text-lg font-bold text-slate-900">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <Button
            className="mt-4 h-14 w-full text-lg font-semibold bg-salsa-500 hover:bg-salsa-600"
            disabled={cart.length === 0 || showOverlay || !taxReady}
            onClick={handleChargeClick}
          >
            Charge {cart.length > 0 ? formatPrice(total) : ''}
          </Button>
        </div>

        {/* Checkout overlay */}
        {showOverlay && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/95 backdrop-blur-sm">
            <CheckoutOverlay
              checkout={checkout}
              cart={cart}
              subtotal={subtotal}
              tax={tax}
              total={total}
              onSelectCard={handleSelectCard}
              onSelectCash={handleSelectCash}
              onCashSubmit={handleCashSubmit}
              onCancel={handleCancelCheckout}
              onRetry={handleRetry}
              retryReady={taxReady}
              onNewSale={handleNewSale}
              onPrint={handlePrintReceipt}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// --- Checkout overlay ---

interface CheckoutOverlayProps {
  checkout: CheckoutState
  cart: POSCartItem[]
  subtotal: number
  tax: number
  total: number
  onSelectCard: () => void
  onSelectCash: () => void
  onCashSubmit: (tendered: number) => void
  onCancel: () => void
  onRetry: () => void
  retryReady: boolean
  onNewSale: () => void
  onPrint: () => void
}

function CheckoutOverlay({
  checkout,
  cart,
  subtotal,
  tax,
  total,
  onSelectCard,
  onSelectCash,
  onCashSubmit,
  onCancel,
  onRetry,
  retryReady,
  onNewSale,
  onPrint,
}: CheckoutOverlayProps) {
  // Payment method selection
  if (checkout.status === 'selecting_payment') {
    return (
      <div className="flex w-full flex-col items-center gap-5 px-6">
        <p className="text-lg font-semibold text-slate-900">Payment Method</p>
        <p className="text-sm text-slate-500">Total: {formatPrice(total)}</p>
        <div className="flex w-full gap-3">
          <button
            onClick={onSelectCard}
            className="flex flex-1 flex-col items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-salsa-400 hover:shadow-md active:scale-95"
          >
            <CreditCard className="h-10 w-10 text-salsa-500" />
            <span className="text-sm font-semibold text-slate-900">Card (Terminal)</span>
          </button>
          <button
            onClick={onSelectCash}
            className="flex flex-1 flex-col items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-6 transition-all hover:border-verde-500 hover:shadow-md active:scale-95"
          >
            <Banknote className="h-10 w-10 text-verde-600" />
            <span className="text-sm font-semibold text-slate-900">Cash</span>
          </button>
        </div>
        <Button variant="ghost" onClick={onCancel} className="text-slate-500">
          Cancel
        </Button>
      </div>
    )
  }

  // Cash tendered input
  if (checkout.status === 'cash_tendered') {
    return (
      <CashTenderedForm
        total={total}
        onSubmit={onCashSubmit}
        onCancel={onCancel}
      />
    )
  }

  // Creating terminal checkout
  if (checkout.status === 'creating') {
    return (
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <Loader2 className="h-12 w-12 animate-spin text-salsa-500" />
        <p className="text-lg font-semibold text-slate-900">Creating checkout...</p>
        <p className="text-sm text-slate-500">
          {checkout.paymentMethod === 'cash' ? 'Recording cash sale' : 'Sending to terminal'}
        </p>
      </div>
    )
  }

  // Waiting for terminal
  if (checkout.status === 'waiting_for_terminal') {
    return (
      <div className="flex flex-col items-center gap-4 px-8 text-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-salsa-200 bg-salsa-50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-salsa-500" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-salsa-400 opacity-75" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-salsa-500" />
          </span>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">
            Waiting for payment on terminal...
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Present the terminal to the customer
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-700">
            {formatPrice(total)}
          </p>
        </div>
        <Button variant="outline" onClick={onCancel} className="mt-2">
          Cancel
        </Button>
      </div>
    )
  }

  // Success
  if (checkout.status === 'success') {
    return (
      <div className="flex w-full flex-col items-center gap-4 px-6 text-center print:px-0">
        <CheckCircle2 className="h-14 w-14 text-green-500 print:hidden" />
        <p className="text-xl font-bold text-slate-900">Payment Complete</p>

        {checkout.orderNumber && (
          <p className="text-sm text-slate-500">Order {checkout.orderNumber}</p>
        )}

        {/* Receipt summary */}
        <div className="w-full rounded-lg border bg-slate-50 p-4 text-left text-sm">
          <div className="space-y-1.5">
            {cart.map((item) => (
              <div key={item.id} className="flex justify-between text-slate-700">
                <span>{item.quantity}x {item.name}</span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 border-t pt-2">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span>{formatPrice(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax</span>
              <span>{formatPrice(tax)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-slate-500 border-t pt-1 mt-1">
              <span>Paid via</span>
              <span className="font-medium">
                {checkout.paymentMethod === 'card' ? 'Card (Terminal)' : 'Cash'}
              </span>
            </div>
            {checkout.paymentMethod === 'cash' && checkout.cashTendered != null && (
              <>
                <div className="flex justify-between text-slate-500">
                  <span>Cash tendered</span>
                  <span>{formatPrice(checkout.cashTendered)}</span>
                </div>
                <div className="flex justify-between font-bold text-verde-700">
                  <span>Change</span>
                  <span>{formatPrice(checkout.changeAmount ?? 0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex w-full gap-3 print:hidden">
          <Button variant="outline" onClick={onPrint} className="flex-1 h-12">
            <Printer className="mr-2 h-4 w-4" />
            Print Receipt
          </Button>
          <Button onClick={onNewSale} className="flex-1 h-12 bg-salsa-500 hover:bg-salsa-600">
            New Order
          </Button>
        </div>
      </div>
    )
  }

  // Failed or timeout
  return (
    <div className="flex flex-col items-center gap-4 px-8 text-center">
      <XCircle className="h-14 w-14 text-red-500" />
      <div>
        <p className="text-lg font-semibold text-slate-900">
          {checkout.status === 'timeout' ? 'Payment Timed Out' : 'Payment Failed'}
        </p>
        {checkout.error && (
          <p className="mt-1 text-sm text-slate-500">{checkout.error}</p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="h-12">
          Cancel
        </Button>
        <Button onClick={onRetry} disabled={!retryReady} className="h-12 bg-salsa-500 hover:bg-salsa-600">
          <RotateCcw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  )
}

// --- Cash tendered form ---

interface CashTenderedFormProps {
  total: number
  onSubmit: (tendered: number) => void
  onCancel: () => void
}

function CashTenderedForm({ total, onSubmit, onCancel }: CashTenderedFormProps) {
  const [tenderedInput, setTenderedInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const tendered = parseFloat(tenderedInput) || 0
  const isValid = tendered >= total
  const change = tendered - total

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Quick-amount buttons for common bills
  const quickAmounts = [1, 5, 10, 20, 50, 100].filter((amt) => amt >= total || amt >= 1)

  return (
    <div className="flex w-full flex-col items-center gap-4 px-6">
      <Banknote className="h-10 w-10 text-verde-600" />
      <p className="text-lg font-semibold text-slate-900">Cash Payment</p>
      <p className="text-sm text-slate-500">Total due: {formatPrice(total)}</p>

      <div className="w-full">
        <label htmlFor="cash-tendered" className="text-sm font-medium text-slate-700">
          Amount tendered
        </label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">$</span>
          <Input
            ref={inputRef}
            id="cash-tendered"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={tenderedInput}
            onChange={(e) => setTenderedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && isValid) {
                onSubmit(tendered)
              }
            }}
            className="pl-8 text-lg h-14 text-right font-semibold"
          />
        </div>
      </div>

      {/* Quick amount buttons */}
      <div className="flex w-full flex-wrap gap-2">
        {quickAmounts.map((amt) => (
          <button
            key={amt}
            onClick={() => setTenderedInput(amt.toFixed(2))}
            className="flex-1 min-w-[60px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-verde-400 hover:bg-verde-50 active:scale-95 transition-all"
          >
            ${amt}
          </button>
        ))}
        <button
          onClick={() => setTenderedInput(Math.ceil(total).toFixed(2))}
          className="flex-1 min-w-[60px] rounded-lg border border-verde-300 bg-verde-50 px-3 py-2 text-sm font-semibold text-verde-700 hover:bg-verde-100 active:scale-95 transition-all"
        >
          Exact
        </button>
      </div>

      {tendered > 0 && (
        <div className={`w-full rounded-lg p-3 text-center ${isValid ? 'bg-verde-50' : 'bg-red-50'}`}>
          {isValid ? (
            <p className="text-lg font-bold text-verde-700">
              Change: {formatPrice(change)}
            </p>
          ) : (
            <p className="text-sm font-medium text-red-600">
              Insufficient: need {formatPrice(total - tendered)} more
            </p>
          )}
        </div>
      )}

      <div className="flex w-full gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-12">
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(tendered)}
          disabled={!isValid}
          className="flex-1 h-12 bg-verde-600 hover:bg-verde-700 disabled:opacity-50"
        >
          Confirm Cash Payment
        </Button>
      </div>
    </div>
  )
}

// --- Empty cart icon ---

function ShoppingCartEmpty({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  )
}
