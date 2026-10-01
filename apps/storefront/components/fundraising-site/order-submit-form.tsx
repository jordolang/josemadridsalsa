'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  KIT_IDS,
  ORDER_KITS,
  PAYMENT_METHODS,
  summarizeOrder,
  type FlavorCategory,
  type KitId,
  type PaymentMethod,
} from '@/lib/fundraising-site/order-submission'

const CONTACT_FIELDS = [
  ['organizationName', 'Organization', 'text', 'organization'],
  ['contactName', 'Your name', 'text', 'name'],
  ['email', 'Email', 'email', 'email'],
  ['phone', 'Phone', 'tel', 'tel'],
] as const
const SHIP_FIELDS = [
  ['shipName', 'Ship to (name or school)', 'text', 'shipping name'],
  ['shipStreet', 'Street address', 'text', 'shipping street-address'],
  ['shipCity', 'City', 'text', 'shipping address-level2'],
  ['shipState', 'State', 'text', 'shipping address-level1'],
  ['shipZip', 'ZIP code', 'text', 'shipping postal-code'],
] as const
type FieldName = (typeof CONTACT_FIELDS)[number][0] | (typeof SHIP_FIELDS)[number][0]

const CATEGORIES: FlavorCategory[] = ['Fruit', 'Specialty', 'Verde', 'Original']
const money = (amount: number) => `$${amount.toLocaleString('en-US')}`

export function OrderSubmitForm() {
  const [kit, setKit] = useState<KitId>('16')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<Record<FieldName, string>>(
    Object.fromEntries([...CONTACT_FIELDS, ...SHIP_FIELDS].map(([name]) => [name, ''])) as Record<FieldName, string>,
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card-online')
  const [notes, setNotes] = useState('')
  const [confirmFinal, setConfirmFinal] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)

  const flavors = ORDER_KITS[kit].flavors
  const numeric = useMemo(
    () => Object.fromEntries(flavors.map((f) => [f.id, Math.max(0, Math.floor(Number(quantities[f.id]) || 0))])),
    [flavors, quantities],
  )
  const summary = summarizeOrder(kit, numeric)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (summary.totalJars === 0) return setError('Enter at least one jar.')
    setStatus('sending')
    try {
      const response = await fetch('/api/fundraising-site/order-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kit, quantities: numeric, ...fields, paymentMethod, notes: notes || undefined, confirmFinal }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'We could not submit your order.')
      setReference(data?.reference ?? null)
      setStatus('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not submit your order.')
      setStatus('idle')
    }
  }

  if (status === 'done') {
    return (
      <div className="card surface-shadow p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-verde-600" aria-hidden />
        <h2 className="mt-4 font-serif text-2xl font-bold text-foreground">Your final order is in!</h2>
        <p className="mt-3 text-muted-foreground">
          We received {summary.totalJars} jars for {fields.organizationName} and will fill the order from the details you
          entered. A copy is on its way to {fields.email}.
        </p>
        {reference ? <p className="mt-2 text-sm text-muted-foreground">Reference: <strong>{reference}</strong></p> : null}
        <p className="mt-4 font-semibold text-foreground">
          Amount due: {money(summary.amountDue)} by {PAYMENT_METHODS[paymentMethod].toLowerCase()}
        </p>
      </div>
    )
  }

  const field = ([name, label, type, autoComplete]: readonly [FieldName, string, string, string]) => (
    <div key={name} className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        value={fields[name]}
        onChange={(e) => setFields((prev) => ({ ...prev, [name]: e.target.value }))}
        {...(name === 'shipZip' ? { inputMode: 'numeric' as const, pattern: '\\d{5}(-\\d{4})?' } : {})}
      />
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="card surface-shadow space-y-8 p-6 sm:p-8">
      <fieldset>
        <legend className="font-serif text-xl font-bold text-foreground">1. Which kit did you use?</legend>
        <div className="mt-3 flex flex-wrap gap-3">
          {KIT_IDS.map((id) => (
            <label
              key={id}
              className={`cursor-pointer rounded-lg border px-4 py-2 font-medium ${kit === id ? 'border-salsa-600 bg-salsa-50 text-salsa-700' : 'border-border'}`}
            >
              <input type="radio" name="kit" value={id} checked={kit === id} onChange={() => setKit(id)} className="sr-only" />
              {ORDER_KITS[id].label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-serif text-xl font-bold text-foreground">2. Jars of each flavor</legend>
        <p className="mt-1 text-sm text-muted-foreground">Copy the totals from your Order Form. Leave a flavor blank for zero.</p>
        <div className="mt-4 space-y-5">
          {CATEGORIES.map((category) => {
            const inCategory = flavors.filter((f) => f.category === category)
            if (inCategory.length === 0) return null
            return (
              <div key={category}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-salsa-700">{category}</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {inCategory.map((flavor) => (
                    <div key={flavor.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-1.5">
                      <Label htmlFor={`qty-${flavor.id}`} className="font-normal">{flavor.name}</Label>
                      <Input
                        id={`qty-${flavor.id}`}
                        type="number"
                        min={0}
                        max={10000}
                        step={1}
                        inputMode="numeric"
                        className="w-20 text-right"
                        value={quantities[flavor.id] ?? ''}
                        onChange={(e) => setQuantities((prev) => ({ ...prev, [flavor.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4">
          {[
            ['Total jars', String(summary.totalJars)],
            ['Sales value', money(summary.salesValue)],
            ['Amount due to us', money(summary.amountDue)],
            ['Your group keeps', money(summary.groupKeeps)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-lg font-bold text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </fieldset>

      <fieldset>
        <legend className="font-serif text-xl font-bold text-foreground">3. Contact &amp; shipping</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">{CONTACT_FIELDS.map(field)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">{SHIP_FIELDS.map(field)}</div>
      </fieldset>

      <fieldset>
        <legend className="font-serif text-xl font-bold text-foreground">4. How will you pay?</legend>
        <div className="mt-3 space-y-2">
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((method) => (
            <label key={method} className="flex items-center gap-2">
              <input
                type="radio"
                name="paymentMethod"
                value={method}
                checked={paymentMethod === method}
                onChange={() => setPaymentMethod(method)}
              />
              {PAYMENT_METHODS[method]}
            </label>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="notes">Notes or special instructions (optional)</Label>
          <Textarea id="notes" rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl border-2 border-salsa-600 bg-salsa-50 p-4">
        <input
          type="checkbox"
          required
          checked={confirmFinal}
          onChange={(e) => setConfirmFinal(e.target.checked)}
          className="mt-1"
        />
        <span className="text-foreground">
          <strong>This order is 100% final.</strong> Every tracking sheet is in, and the jar counts and money match. We
          will fill the order exactly as entered.
        </span>
      </label>

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={status === 'sending'}
        className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700"
      >
        {status === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        Submit final order ({summary.totalJars} jars · {money(summary.amountDue)} due)
      </Button>
    </form>
  )
}
