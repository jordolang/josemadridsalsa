/**
 * Creating an invoice — the one set of rules shared by the desktop admin shell
 * (`lib/admin-desktop/writes.ts`) and the web form at `/admin/invoices/new`.
 *
 * The total is always derived from the lines on the server, never taken from
 * what the operator typed, and a blank number generates one.
 */

import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const INVOICE_STATUSES = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number]

export const invoiceLinesSchema = z
  .array(
    z.object({
      description: z.string().trim().min(1, 'Description is required'),
      quantity: z.coerce.number().int().positive('Quantity must be at least 1'),
      unitPrice: z.coerce.number().min(0, 'Price cannot be negative'),
    }),
  )
  .min(1, 'Add at least one line')

export type InvoiceLineInput = z.output<typeof invoiceLinesSchema>[number]

export interface CreateInvoiceInput {
  number: string | null
  customerId: string | null
  status: InvoiceStatusValue
  dueDate: Date
  notes: string | null
  lines: InvoiceLineInput[]
}

/** The lines as stored (each with its amount) and the invoice total. */
export function priceInvoiceLines(lines: InvoiceLineInput[]) {
  return {
    total: new Prisma.Decimal(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0).toFixed(2)),
    lines: lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      amount: Number((line.quantity * line.unitPrice).toFixed(2)),
    })),
  }
}

// ponytail: random 4-digit suffix per day; a collision surfaces as the unique-number error
// and a retry. Switch to a sequence if invoice volume ever makes that likely.
export function generateInvoiceNumber(now = new Date()): string {
  return `INV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 9000 + 1000)}`
}

/** Writes the invoice. Prisma errors (e.g. P2002 on a taken number) propagate to the caller. */
export async function createInvoice(input: CreateInvoiceInput) {
  const now = new Date()
  const { total, lines } = priceInvoiceLines(input.lines)

  return prisma.invoice.create({
    data: {
      number: input.number ?? generateInvoiceNumber(now),
      customerId: input.customerId,
      status: input.status,
      dueDate: input.dueDate,
      total,
      lines,
      notes: input.notes,
      sentAt: input.status === 'SENT' ? now : null,
      paidAt: input.status === 'PAID' ? now : null,
    },
    select: { id: true, number: true },
  })
}

const blankToNull = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : null))

/**
 * The web form's values. A `date` input is pinned to midday UTC, as the desktop
 * shell does, so the 15th never reads as the 14th in store time.
 */
export const createInvoiceFormSchema = z.object({
  number: blankToNull,
  customerId: blankToNull,
  status: z.enum(INVOICE_STATUSES, { message: 'Choose a status' }),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date is required')
    .transform((value) => new Date(`${value}T12:00:00.000Z`))
    .refine((date) => !Number.isNaN(date.getTime()), 'That is not a valid date'),
  notes: blankToNull,
  lines: invoiceLinesSchema,
})
