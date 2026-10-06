'use client'

import { useMemo, useState } from 'react'
import { CheckCircle2, CreditCard, Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SignaturePad } from '@/components/waiver/SignaturePad'
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

/** `groups`: the fundraising store's checkout groups, or null when they could not be loaded. */
export function OrderSubmitForm({ groups }: { groups: string[] | null }) {
  const [kit, setKit] = useState<KitId>('16')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [fields, setFields] = useState<Record<FieldName, string>>(
    Object.fromEntries([...CONTACT_FIELDS, ...SHIP_FIELDS].map(([name]) => [name, ''])) as Record<FieldName, string>,
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(groups?.length ? 'card-online' : 'check')
  const [notes, setNotes] = useState('')
  const [confirmFinal, setConfirmFinal] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState<string | null>(null)
  const [group, setGroup] = useState('')
  const [checkout, setCheckout] = useState<{ url: string; total: number } | null>(null)
  const cardOnline = paymentMethod === 'card-online'
  const cardAvailable = groups !== null && groups.length > 0

  const flavors = ORDER_KITS[kit].flavors
  const numeric = useMemo(
    () => Object.fromEntries(flavors.map((f) => [f.id, Math.max(0, Math.floor(Number(quantities[f.id]) || 0))])),
    [flavors, quantities],
  )
  const summary = summarizeOrder(kit, numeric)

  /** One jar more or less; 0 shows as blank, like a flavor never typed in. */
  const stepJars = (id: string, delta: number) =>
    setQuantities((prev) => {
      const next = Math.min(10_000, Math.max(0, Math.floor(Number(prev[id]) || 0) + delta))
      return { ...prev, [id]: next === 0 ? '' : String(next) }
    })

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (summary.totalJars === 0) return setError('Enter at least one jar.')
    if (!signature) return setError('Please sign the order.')
    if (cardOnline && !group) return setError('Choose your group to pay by card online.')
    setStatus('sending')
    try {
      const response = await fetch('/api/fundraising-site/order-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kit,
          quantities: numeric,
          ...fields,
          paymentMethod,
          notes: notes || undefined,
          group: cardOnline ? group : undefined,
          confirmFinal,
          signature,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) throw new Error(data?.error || 'We could not submit your order.')
      setReference(data?.reference ?? null)
      setCheckout(data?.checkoutUrl ? { url: data.checkoutUrl, total: data.cardTotal ?? summary.amountDue } : null)
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
        {checkout ? (
          <>
            <Button
              size="lg"
              className="mt-6 h-auto whitespace-normal bg-gradient-to-r from-salsa-600 to-chile-600 py-3 hover:from-salsa-700 hover:to-chile-700"
              asChild
            >
              <a href={checkout.url}>
                <CreditCard className="mr-2 h-5 w-5" aria-hidden /> Pay {money(checkout.total)} by card now
              </a>
            </Button>
            <p className="mt-3 text-sm text-muted-foreground">
              {money(summary.amountDue)} for {summary.totalJars} jars plus shipping, on our secure checkout. The link is also in
              your confirmation email.
            </p>
          </>
        ) : cardOnline ? (
          <p className="mt-4 font-semibold text-foreground">
            We could not open card checkout just now. We will contact you to take your {money(summary.amountDue)} payment.
          </p>
        ) : (
          <p className="mt-4 font-semibold text-foreground">
            Amount due: {money(summary.amountDue)} by {PAYMENT_METHODS[paymentMethod].toLowerCase()}
          </p>
        )}
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
        <p className="mt-1 text-sm text-muted-foreground">
          Copy the totals from your Order Form, or tap + and − to add or remove one jar. Leave a flavor blank for zero.
        </p>
        <div className="mt-4 space-y-5">
          {CATEGORIES.map((category) => {
            const inCategory = flavors.filter((f) => f.category === category)
            if (inCategory.length === 0) return null
            return (
              <div key={category}>
                <h3 className="text-sm font-bold uppercase tracking-wide text-salsa-700">{category}</h3>
                <div className="mt-2 grid gap-2 xl:grid-cols-2">
                  {inCategory.map((flavor) => {
                    const jars = numeric[flavor.id] ?? 0
                    return (
                      <div
                        key={flavor.id}
                        className={`flex items-center justify-between gap-3 rounded-md border px-3 py-1.5 ${jars > 0 ? 'border-salsa-300 bg-salsa-50/50' : 'border-border'}`}
                      >
                        <Label htmlFor={`qty-${flavor.id}`} className="font-normal">{flavor.name}</Label>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => stepJars(flavor.id, -1)}
                            disabled={jars === 0}
                            aria-label={`Remove one jar of ${flavor.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background hover:border-salsa-400 hover:bg-salsa-50 disabled:opacity-40"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                          </button>
                          <Input
                            id={`qty-${flavor.id}`}
                            type="number"
                            min={0}
                            max={10000}
                            step={1}
                            inputMode="numeric"
                            placeholder="0"
                            className="h-10 w-16 text-center text-base font-semibold"
                            value={quantities[flavor.id] ?? ''}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => setQuantities((prev) => ({ ...prev, [flavor.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            onClick={() => stepJars(flavor.id, 1)}
                            aria-label={`Add one jar of ${flavor.name}`}
                            className="flex h-10 w-10 items-center justify-center rounded-full bg-salsa-600 text-white hover:bg-salsa-700"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <dl aria-live="polite" className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-muted p-4 text-sm sm:grid-cols-4">
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
          {(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((method) => {
            const unavailable = method === 'card-online' && !cardAvailable
            return (
              <label key={method} className={`flex items-center gap-2 ${unavailable ? 'opacity-50' : ''}`}>
                <input
                  type="radio"
                  name="paymentMethod"
                  value={method}
                  checked={paymentMethod === method}
                  disabled={unavailable}
                  onChange={() => setPaymentMethod(method)}
                />
                {PAYMENT_METHODS[method]}
                {method === 'card-online' ? (
                  <span className="text-sm text-muted-foreground">
                    {unavailable ? '(unavailable right now)' : '— pay right after you submit'}
                  </span>
                ) : null}
              </label>
            )
          })}
        </div>
        {cardOnline && cardAvailable ? (
          <div className="mt-4 space-y-1.5 rounded-lg border border-border p-4">
            <Label htmlFor="fundraising-group">Your group</Label>
            <Select value={group} onValueChange={setGroup}>
              <SelectTrigger id="fundraising-group" className="w-full">
                <SelectValue placeholder="Choose your group" />
              </SelectTrigger>
              <SelectContent>
                {groups!.map((label) => (
                  <SelectItem key={label} value={label}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              You&apos;ll pay {money(summary.amountDue)} plus shipping on our secure checkout. Group not listed? Choose check
              or card by phone, or call {'740-521-4304'} and we&apos;ll add it.
            </p>
          </div>
        ) : null}
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

      <div>
        <p className="mb-2 font-medium text-foreground">
          Sign this order{fields.contactName ? `, ${fields.contactName}` : ''} <span className="text-salsa-700">(required)</span>
        </p>
        <SignaturePad onChange={setSignature} disabled={status === 'sending'} />
        <p className="mt-2 text-xs text-muted-foreground">
          Draw your signature with a finger, stylus or mouse. Each order you submit is signed separately.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={status === 'sending' || !confirmFinal || !signature || (cardOnline && !group)}
        className="w-full bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700"
      >
        {status === 'sending' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
        Submit final order ({summary.totalJars} jars · {money(summary.amountDue)} due)
      </Button>
    </form>
  )
}
