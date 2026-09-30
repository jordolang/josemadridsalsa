'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, FileDown, Loader2, Minus, Plus, RotateCcw, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SignaturePad } from '@/components/waiver/SignaturePad'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import {
  ORDER_FORM_CATEGORIES,
  ORDER_FORM_DUE_CENTS,
  ORDER_FORM_FREE_SHIPPING_JARS,
  ORDER_FORM_MAX_PER_FLAVOR,
  ORDER_FORM_RETAIL_CENTS,
  clampJarCount,
  computeOrderFormTotals,
  formatOrderFormCents,
  orderFormAgreementText,
  type OrderFormQuantities,
  type OrderFormSubmissionInput,
  type OrderFormTotals,
} from '@/lib/fundraising-site/order-form'
import { cn } from '@/lib/utils'

type Contact = {
  organizationName: string
  contactName: string
  email: string
  phone: string
  shipName: string
  street: string
  city: string
  state: string
  postalCode: string
  notes: string
}

const EMPTY_CONTACT: Contact = {
  organizationName: '',
  contactName: '',
  email: '',
  phone: '',
  shipName: '',
  street: '',
  city: '',
  state: 'OH',
  postalCode: '',
  notes: '',
}

type SubmittedOrder = { code: string; totals: OrderFormTotals; pdfUrl: string | null; email: string }

const HEAT_STYLES: Record<string, string> = {
  Mild: 'bg-verde-100 text-verde-800',
  Medium: 'bg-yellow-100 text-yellow-800',
  Hot: 'bg-orange-100 text-orange-800',
  'X-Hot': 'bg-salsa-100 text-salsa-800',
  'XX-Hot': 'bg-chile-600 text-white',
}

function Field({
  label,
  id,
  className,
  ...props
}: { label: string; id: string; className?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <Input id={id} name={id} {...props} />
    </div>
  )
}

function SectionHeading({ step, title, children }: { step: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-salsa-600 text-sm font-bold text-white">
        {step}
      </span>
      <div>
        <h2 className="font-serif text-2xl font-bold text-foreground">{title}</h2>
        {children ? <p className="mt-1 text-sm text-muted-foreground">{children}</p> : null}
      </div>
    </div>
  )
}

function JarStepper({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onChange(clampJarCount(value - 1))}
        disabled={value === 0}
        aria-label={`Remove one jar of ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:border-salsa-400 hover:bg-salsa-50 active:bg-salsa-100 disabled:opacity-40 disabled:hover:bg-background"
      >
        <Minus className="h-5 w-5" aria-hidden />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={ORDER_FORM_MAX_PER_FLAVOR}
        step={1}
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={(event) => onChange(clampJarCount(Number(event.target.value)))}
        onFocus={(event) => event.target.select()}
        aria-label={`Jars of ${label}`}
        className={cn(
          'h-11 w-20 rounded-lg border bg-background text-center text-lg font-semibold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-salsa-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          value > 0 ? 'border-salsa-500 text-foreground' : 'border-border text-muted-foreground',
        )}
      />
      <button
        type="button"
        onClick={() => onChange(clampJarCount(value + 1))}
        aria-label={`Add one jar of ${label}`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-salsa-600 text-white transition-colors hover:bg-salsa-700 active:bg-salsa-800"
      >
        <Plus className="h-5 w-5" aria-hidden />
      </button>
    </div>
  )
}

function TotalsPanel({ totals, className }: { totals: OrderFormTotals; className?: string }) {
  const progress = Math.min(100, (totals.totalJars / ORDER_FORM_FREE_SHIPPING_JARS) * 100)
  return (
    <div className={cn('rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5', className)} aria-live="polite">
      <h2 className="font-serif text-xl font-bold text-foreground">Order totals</h2>
      <dl className="mt-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <dt className="text-muted-foreground">Total jars</dt>
          <dd className="text-3xl font-bold tabular-nums text-foreground">{totals.totalJars}</dd>
        </div>
        <div className="flex items-baseline justify-between border-t pt-3">
          <dt className="text-muted-foreground">
            Total sales <span className="text-xs">(@ {formatOrderFormCents(ORDER_FORM_RETAIL_CENTS)}/jar)</span>
          </dt>
          <dd className="text-lg font-semibold tabular-nums">{formatOrderFormCents(totals.retailCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between rounded-lg bg-salsa-50 px-3 py-2">
          <dt className="font-semibold text-salsa-800">
            Amount due <span className="text-xs font-normal">(@ {formatOrderFormCents(ORDER_FORM_DUE_CENTS)}/jar)</span>
          </dt>
          <dd className="text-xl font-bold tabular-nums text-salsa-800">{formatOrderFormCents(totals.dueCents)}</dd>
        </div>
        <div className="flex items-baseline justify-between rounded-lg bg-verde-50 px-3 py-2">
          <dt className="font-semibold text-verde-800">Your group&apos;s profit</dt>
          <dd className="text-xl font-bold tabular-nums text-verde-800">{formatOrderFormCents(totals.profitCents)}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t pt-4 text-sm">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <Truck className="h-4 w-4 text-salsa-600" aria-hidden />
          {totals.freeShipping
            ? 'Free shipping unlocked!'
            : `${totals.jarsToFreeShipping} more jar${totals.jarsToFreeShipping === 1 ? '' : 's'} for free shipping`}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', totals.freeShipping ? 'bg-verde-600' : 'bg-salsa-500')}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Orders of {ORDER_FORM_FREE_SHIPPING_JARS}+ jars ship free. Smaller orders: we confirm shipping with you.
        </p>
      </div>
    </div>
  )
}

export function FundraiserOrderForm() {
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT)
  const [quantities, setQuantities] = useState<OrderFormQuantities>({})
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState<string | null>(null)
  const [signatureKey, setSignatureKey] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [submitted, setSubmitted] = useState<SubmittedOrder | null>(null)

  const totals = useMemo(() => computeOrderFormTotals(quantities), [quantities])

  const update = (key: keyof Contact) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setContact((prev) => ({ ...prev, [key]: event.target.value }))

  const setJars = (flavorId: string, jars: number) => setQuantities((prev) => ({ ...prev, [flavorId]: jars }))

  const missing: string[] = []
  if (totals.totalJars < 1) missing.push('add at least one jar')
  if (!agreed) missing.push('check the confirmation box')
  if (!signature) missing.push('sign the form')

  function resetForm() {
    setContact(EMPTY_CONTACT)
    setQuantities({})
    setAgreed(false)
    setSignature(null)
    setSignatureKey((key) => key + 1)
    setErrors([])
    setSubmitted(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (missing.length > 0 || !signature) {
      setErrors([`Before submitting, please ${missing.join(', ')}.`])
      return
    }
    setIsSubmitting(true)
    setErrors([])

    const payload: OrderFormSubmissionInput = {
      organizationName: contact.organizationName,
      contactName: contact.contactName,
      email: contact.email,
      phone: contact.phone,
      shipTo: {
        name: contact.shipName || contact.contactName,
        street: contact.street,
        city: contact.city,
        state: contact.state,
        postalCode: contact.postalCode,
      },
      notes: contact.notes,
      quantities,
      agreed: true,
      signature,
    }

    try {
      const response = await fetch('/api/fundraiser-order-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) {
        const body = (data ?? {}) as { error?: string; details?: Record<string, string[] | undefined> }
        const details = Object.values(body.details ?? {}).flatMap((messages) => messages ?? [])
        setErrors(details.length > 0 ? details : [body.error ?? 'Unable to submit the order form.'])
        toast.error('Order not submitted', { description: body.error ?? 'Please check the form and try again.' })
        return
      }
      const result = data as { code: string; totals: OrderFormTotals; pdfUrl: string | null }
      setSubmitted({ ...result, email: contact.email })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErrors(['We could not reach the server. Check your connection and try again.'])
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-black/5">
        <CheckCircle2 className="mx-auto h-14 w-14 text-verde-600" aria-hidden />
        <h2 className="mt-4 font-serif text-3xl font-bold text-foreground">Order form received!</h2>
        <p className="mt-2 text-muted-foreground">
          Reference <span className="font-mono font-semibold text-foreground">{submitted.code}</span>. A copy is on its way to{' '}
          {submitted.email}.
        </p>
        <dl className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">Jars</dt>
            <dd className="text-2xl font-bold">{submitted.totals.totalJars}</dd>
          </div>
          <div className="rounded-xl bg-salsa-50 p-3">
            <dt className="text-xs text-salsa-800">Amount due</dt>
            <dd className="text-2xl font-bold text-salsa-800">{formatOrderFormCents(submitted.totals.dueCents)}</dd>
          </div>
          <div className="rounded-xl bg-verde-50 p-3">
            <dt className="text-xs text-verde-800">Your profit</dt>
            <dd className="text-2xl font-bold text-verde-800">{formatOrderFormCents(submitted.totals.profitCents)}</dd>
          </div>
        </dl>
        <div className="mt-6 rounded-xl border border-border p-5 text-left text-sm">
          <p className="font-semibold text-foreground">How to pay</p>
          <p className="mt-2 text-muted-foreground">
            Mail a check payable to &ldquo;Jose Madrid Salsa&rdquo; to {FUNDRAISING_CONTACT.mailingAddress.join(', ')}, or call{' '}
            <a href={FUNDRAISING_CONTACT.phoneHref} className="font-medium text-salsa-600 hover:underline">
              {FUNDRAISING_CONTACT.phone}
            </a>{' '}
            to pay by credit card. Please mention {submitted.code}. Your order ships once payment is received.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {submitted.pdfUrl ? (
            <Button asChild variant="outline">
              <a href={submitted.pdfUrl} target="_blank" rel="noopener noreferrer">
                <FileDown className="mr-2 h-4 w-4" aria-hidden /> Signed order form (PDF)
              </a>
            </Button>
          ) : null}
          <Button onClick={resetForm} className="bg-salsa-600 hover:bg-salsa-700">
            Submit another order
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <section className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <SectionHeading step={1} title="Fundraiser information" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="organizationName"
              label="Fundraiser / organization name"
              required
              autoComplete="organization"
              placeholder="Lincoln Elementary PTO"
              value={contact.organizationName}
              onChange={update('organizationName')}
              className="sm:col-span-2"
            />
            <Field
              id="contactName"
              label="Your name"
              required
              autoComplete="name"
              value={contact.contactName}
              onChange={update('contactName')}
            />
            <Field
              id="phone"
              label="Phone number"
              type="tel"
              required
              autoComplete="tel"
              placeholder="740-555-0123"
              value={contact.phone}
              onChange={update('phone')}
            />
            <Field
              id="email"
              label="Email address"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={contact.email}
              onChange={update('email')}
              className="sm:col-span-2"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <SectionHeading step={2} title="Shipping information">
            Where should we deliver the order?
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-6">
            <Field
              id="shipName"
              label="Ship to (name)"
              autoComplete="shipping name"
              placeholder={contact.contactName || 'Recipient name'}
              value={contact.shipName}
              onChange={update('shipName')}
              className="sm:col-span-6"
            />
            <Field
              id="street"
              label="Street address"
              required
              autoComplete="shipping street-address"
              value={contact.street}
              onChange={update('street')}
              className="sm:col-span-6"
            />
            <Field
              id="city"
              label="City"
              required
              autoComplete="shipping address-level2"
              value={contact.city}
              onChange={update('city')}
              className="sm:col-span-3"
            />
            <Field
              id="state"
              label="State"
              required
              autoComplete="shipping address-level1"
              value={contact.state}
              onChange={update('state')}
              className="sm:col-span-1"
            />
            <Field
              id="postalCode"
              label="ZIP code"
              required
              inputMode="numeric"
              autoComplete="shipping postal-code"
              pattern="\d{5}(-\d{4})?"
              value={contact.postalCode}
              onChange={update('postalCode')}
              className="sm:col-span-2"
            />
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeading step={3} title="Flavors">
              Enter the total jars of each flavor, or tap + and − to add or remove one jar at a time.
            </SectionHeading>
            {totals.totalJars > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setQuantities({})}>
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> Clear all
              </Button>
            ) : null}
          </div>

          <div className="space-y-8">
            {ORDER_FORM_CATEGORIES.map((category) => (
              <fieldset key={category.id}>
                <legend className="flex w-full items-center justify-between border-b-2 border-salsa-600 pb-1.5">
                  <span className="text-sm font-bold uppercase tracking-widest text-salsa-700">{category.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    {totals.categoryJars[category.id] ?? 0} jar{totals.categoryJars[category.id] === 1 ? '' : 's'}
                  </span>
                </legend>
                <ul className="divide-y">
                  {category.flavors.map((flavor) => {
                    const jars = quantities[flavor.id] ?? 0
                    const label = `${flavor.name} ${flavor.heat}`
                    return (
                      <li
                        key={flavor.id}
                        className={cn(
                          'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3',
                          jars > 0 && 'bg-salsa-50/40',
                        )}
                      >
                        <label htmlFor={`qty-${flavor.id}`} className="min-w-0 flex-1 basis-48">
                          <span className="font-medium text-foreground">{flavor.name}</span>{' '}
                          <span
                            className={cn(
                              'ml-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                              HEAT_STYLES[flavor.heat] ?? 'bg-muted text-foreground',
                            )}
                          >
                            {flavor.heat}
                          </span>
                        </label>
                        <div className="flex items-center gap-4">
                          <JarStepper
                            id={`qty-${flavor.id}`}
                            label={label}
                            value={jars}
                            onChange={(next) => setJars(flavor.id, next)}
                          />
                          <span
                            className={cn(
                              'w-20 text-right tabular-nums',
                              jars > 0 ? 'font-semibold text-foreground' : 'text-muted-foreground',
                            )}
                          >
                            {formatOrderFormCents(jars * ORDER_FORM_RETAIL_CENTS)}
                          </span>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </fieldset>
            ))}
          </div>

          <div className="mt-8 space-y-1.5">
            <label htmlFor="notes" className="text-sm font-medium text-foreground">
              Notes (optional)
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={1000}
              placeholder="Delivery instructions, deadlines, anything we should know"
              value={contact.notes}
              onChange={update('notes')}
            />
          </div>
        </section>

        <TotalsPanel totals={totals} className="lg:hidden" />

        <section className="rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5 sm:p-8">
          <SectionHeading step={4} title="Confirm and sign">
            Sign each order you submit. The signed form is emailed to you and to our fundraising team.
          </SectionHeading>

          <label
            htmlFor="agreed"
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors',
              agreed ? 'border-verde-600 bg-verde-50' : 'border-border hover:border-salsa-300',
            )}
          >
            <input
              id="agreed"
              name="agreed"
              type="checkbox"
              required
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-verde-600"
            />
            <span className="text-sm text-foreground">
              {orderFormAgreementText(totals)} <span className="font-semibold text-salsa-700">(required)</span>
            </span>
          </label>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-foreground">
              Signature{contact.contactName ? ` of ${contact.contactName}` : ''}{' '}
              <span className="font-semibold text-salsa-700">(required)</span>
            </p>
            <SignaturePad key={signatureKey} onChange={setSignature} disabled={isSubmitting} />
            <p className="mt-2 text-xs text-muted-foreground">
              Draw your signature with a finger, stylus or mouse. By signing, you are signing this order form electronically.
            </p>
          </div>

          {errors.length > 0 ? (
            <div role="alert" className="mt-6 rounded-xl border border-salsa-300 bg-salsa-50 p-4 text-sm text-salsa-800">
              <ul className="list-inside list-disc space-y-1">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            type="submit"
            size="lg"
            disabled={isSubmitting || missing.length > 0}
            className="mt-6 h-auto w-full whitespace-normal bg-gradient-to-r from-salsa-600 to-chile-600 py-4 text-lg hover:from-salsa-700 hover:to-chile-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden /> Submitting…
              </>
            ) : (
              `Submit signed order · ${totals.totalJars} jar${totals.totalJars === 1 ? '' : 's'} · ${formatOrderFormCents(totals.dueCents)} due`
            )}
          </Button>
          {missing.length > 0 ? (
            <p className="mt-2 text-center text-sm text-muted-foreground">To submit, {missing.join(', ')}.</p>
          ) : null}
        </section>
      </div>

      {/* Phones: the running totals stay on screen while scrolling the flavor list. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3 text-sm" aria-hidden>
          <span>
            <span className="text-lg font-bold tabular-nums text-foreground">{totals.totalJars}</span>{' '}
            <span className="text-muted-foreground">jars</span>
          </span>
          <span>
            <span className="text-muted-foreground">Sales </span>
            <span className="font-semibold tabular-nums">{formatOrderFormCents(totals.retailCents)}</span>
          </span>
          <span>
            <span className="text-muted-foreground">Due </span>
            <span className="font-bold tabular-nums text-salsa-700">{formatOrderFormCents(totals.dueCents)}</span>
          </span>
        </div>
      </div>

      <aside className="hidden lg:block">
        <TotalsPanel totals={totals} className="sticky top-24" />
      </aside>
    </form>
  )
}
