'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CreateInvoiceState } from './actions'

const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

/** Radix Select cannot hold an empty value, so "no customer" needs a stand-in. */
const NO_CUSTOMER = 'none'

interface Line {
  description: string
  quantity: string
  unitPrice: string
}

const blankLine = (): Line => ({ description: '', quantity: '1', unitPrice: '' })

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create invoice'}
    </Button>
  )
}

export function InvoiceForm({
  action,
  customers,
}: {
  action: (state: CreateInvoiceState, formData: FormData) => Promise<CreateInvoiceState>
  customers: { id: string; label: string; email: string }[]
}) {
  const [state, formAction] = useActionState(action, {})
  const [number, setNumber] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [customerId, setCustomerId] = useState(NO_CUSTOMER)
  const [status, setStatus] = useState('DRAFT')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([blankLine()])

  const errors = state.errors ?? {}
  // Preview only — the server recomputes the total from the lines.
  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0)

  const setLine = (index: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)))

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId === NO_CUSTOMER ? '' : customerId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />

      {state.message && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="invoice-number">Invoice number</Label>
            <Input
              id="invoice-number"
              name="number"
              placeholder="Blank generates the next one"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
            <FieldError message={errors.number} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-due">Due date</Label>
            <Input
              id="invoice-due"
              name="dueDate"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <FieldError message={errors.dueDate} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-customer">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger id="invoice-customer">
                <SelectValue placeholder="Choose a customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>No customer (manual billing)</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.label}
                    {customer.label !== customer.email && (
                      <span className="ml-2 text-muted-foreground">{customer.email}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.customerId} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="invoice-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="invoice-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError message={errors.status} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="invoice-notes">Notes (optional)</Label>
            <Textarea
              id="invoice-notes"
              name="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-sm font-semibold">Lines</h2>
          <FieldError message={errors.lines} />

          {lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-start gap-3 rounded-md border p-3">
              <div className="min-w-48 flex-1 space-y-1">
                <Label className="text-xs" htmlFor={`line-desc-${index}`}>
                  Description
                </Label>
                <Input
                  id={`line-desc-${index}`}
                  value={line.description}
                  required
                  onChange={(e) => setLine(index, { description: e.target.value })}
                />
                <FieldError message={errors[`lines.${index}.description`]} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`line-qty-${index}`}>
                  Qty
                </Label>
                <Input
                  id={`line-qty-${index}`}
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={line.quantity}
                  required
                  onChange={(e) => setLine(index, { quantity: e.target.value })}
                />
                <FieldError message={errors[`lines.${index}.quantity`]} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs" htmlFor={`line-price-${index}`}>
                  Unit price
                </Label>
                <Input
                  id={`line-price-${index}`}
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-28"
                  value={line.unitPrice}
                  required
                  onChange={(e) => setLine(index, { unitPrice: e.target.value })}
                />
                <FieldError message={errors[`lines.${index}.unitPrice`]} />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-5"
                disabled={lines.length === 1}
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}

          <div className="flex items-center justify-between border-t pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, blankLine()])}>
              Add a line
            </Button>
            <p className="text-sm font-medium tabular-nums">Total ${total.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <SubmitButton />
        <Button variant="ghost" asChild>
          <Link href="/admin/invoices">Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
