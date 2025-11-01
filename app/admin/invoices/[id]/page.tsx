import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { formatPrice } from '@/lib/utils'
import { logAudit } from '@/lib/audit'
import Link from 'next/link'

type PageProps = {
  params: Promise<{ id: string }>
}

type InvoiceLine = {
  description: string
  quantity: number
  unitPrice: number
  total: number
  notes?: string
}

function normalizeLine(line: any, index: number): InvoiceLine {
  const description =
    line?.description ||
    line?.name ||
    line?.title ||
    `Line ${index + 1}`

  const quantityValue = Number(line?.quantity ?? 1)
  const unitPriceValue = Number(line?.unitPrice ?? line?.price ?? 0)
  const explicitTotal = Number(line?.total ?? line?.amount ?? line?.lineTotal ?? 0)
  const computedTotal =
    !Number.isNaN(quantityValue) && !Number.isNaN(unitPriceValue)
      ? quantityValue * unitPriceValue
      : 0

  return {
    description,
    quantity: Number.isFinite(quantityValue) ? quantityValue : 1,
    unitPrice: Number.isFinite(unitPriceValue) ? unitPriceValue : 0,
    total: Number.isFinite(explicitTotal) && explicitTotal > 0 ? explicitTotal : computedTotal,
    notes: typeof line?.notes === 'string' ? line.notes : undefined,
  }
}

function parseInvoiceLines(lines: any): InvoiceLine[] {
  try {
    const raw =
      typeof lines === 'string'
        ? JSON.parse(lines)
        : lines

    if (!Array.isArray(raw)) {
      return []
    }

    return raw.map((line, index) => normalizeLine(line, index))
  } catch {
    return []
  }
}

async function updateInvoiceStatus(invoiceId: string, status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED') {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:refunds'))) {
    throw new Error('Unauthorized')
  }

  const now = new Date()
  const data: any = {
    status,
  }

  if (status === 'SENT') {
    data.sentAt = now
  } else if (status === 'PAID') {
    data.paidAt = now
  } else if (status === 'CANCELLED') {
    data.paidAt = null
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data,
  })

  await logAudit({
    userId: user.id,
    action: 'invoice.status_change',
    entityType: 'Invoice',
    entityId: invoiceId,
    changes: { status },
  })

  revalidatePath(`/admin/invoices/${invoiceId}`)
  revalidatePath('/admin/invoices')
}

async function updateInvoiceNotes(invoiceId: string, formData: FormData) {
  'use server'

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:refunds'))) {
    throw new Error('Unauthorized')
  }

  const notes = formData.get('notes')

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      notes: typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null,
    },
  })

  await logAudit({
    userId: user.id,
    action: 'invoice.notes_update',
    entityType: 'Invoice',
    entityId: invoiceId,
  })

  revalidatePath(`/admin/invoices/${invoiceId}`)
}

const statusStyles: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
}

export default async function InvoiceDetailPage(props: PageProps) {
  const params = await props.params
  const invoiceId = params.id

  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:read'))) {
    redirect('/admin')
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  })

  if (!invoice) {
    notFound()
  }

  const lines = parseInvoiceLines(invoice.lines)
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const canEdit = await hasPermission(user, 'financials:refunds')

  const markSent = updateInvoiceStatus.bind(null, invoiceId, 'SENT')
  const markPaid = updateInvoiceStatus.bind(null, invoiceId, 'PAID')
  const markCancelled = updateInvoiceStatus.bind(null, invoiceId, 'CANCELLED')
  const markDraft = updateInvoiceStatus.bind(null, invoiceId, 'DRAFT')
  const markOverdue = updateInvoiceStatus.bind(null, invoiceId, 'OVERDUE')
  const notesAction = updateInvoiceNotes.bind(null, invoiceId)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{invoice.number}</h1>
            <Badge className={statusStyles[invoice.status] || 'bg-slate-100 text-slate-600'}>
              {invoice.status}
            </Badge>
          </div>
          <p className="text-slate-600">
            Issued {invoice.createdAt.toLocaleDateString()} • Due{' '}
            {invoice.dueDate.toLocaleDateString()}
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <form action={markSent}>
              <Button type="submit" size="sm" variant="outline">
                Mark sent
              </Button>
            </form>
            <form action={markPaid}>
              <Button type="submit" size="sm">
                Mark paid
              </Button>
            </form>
            <form action={markOverdue}>
              <Button type="submit" size="sm" variant="outline">
                Set overdue
              </Button>
            </form>
            <form action={markCancelled}>
              <Button type="submit" size="sm" variant="outline">
                Cancel
              </Button>
            </form>
            <form action={markDraft}>
              <Button type="submit" size="sm" variant="outline">
                Move to draft
              </Button>
            </form>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Line items</h2>
          {lines.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              This invoice has no line items. Update the invoice to add billing rows.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead className="border-b bg-slate-50 text-sm text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Description</th>
                    <th className="px-4 py-3 text-right font-medium">Qty</th>
                    <th className="px-4 py-3 text-right font-medium">Unit price</th>
                    <th className="px-4 py-3 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {lines.map((line, index) => (
                    <tr key={`${line.description}-${index}`} className="border-b last:border-0">
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-800">{line.description}</p>
                        {line.notes && (
                          <p className="text-xs text-slate-500">{line.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {line.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-4 text-right text-slate-600">
                        {formatPrice(line.unitPrice)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">
                        {formatPrice(line.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-6 flex justify-end border-t pt-4">
            <div className="space-y-2 text-right text-sm text-slate-600">
              <p>
                Subtotal:{' '}
                <span className="font-semibold text-slate-900">
                  {formatPrice(subtotal)}
                </span>
              </p>
              <p>
                Invoice total:{' '}
                <span className="font-semibold text-slate-900">
                  {formatPrice(Number(invoice.total || 0))}
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Details</h2>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>
                Customer:{' '}
                <span className="font-semibold text-slate-900">
                  {invoice.customerId || 'Manual billing'}
                </span>
              </p>
              <p>
                Linked order:{' '}
                {invoice.orderId ? (
                  <Link
                    href={`/admin/orders/${invoice.orderId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    View order
                  </Link>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </p>
              <p>
                Sent at:{' '}
                <span className="text-slate-700">
                  {invoice.sentAt ? invoice.sentAt.toLocaleString() : 'Not sent'}
                </span>
              </p>
              <p>
                Paid:{' '}
                <span className="text-slate-700">
                  {invoice.paidAt ? invoice.paidAt.toLocaleString() : 'Unpaid'}
                </span>
              </p>
            </div>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Notes</h2>
            {canEdit ? (
              <form action={notesAction} className="mt-3 space-y-3">
                <Textarea
                  name="notes"
                  defaultValue={invoice.notes || ''}
                  rows={6}
                  className="font-mono text-xs"
                  placeholder="Internal notes or payment terms..."
                />
                <Button type="submit" size="sm" className="self-end">
                  Save notes
                </Button>
              </form>
            ) : (
              <div className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                {invoice.notes || 'No notes added to this invoice.'}
              </div>
            )}
          </div>
          {!canEdit && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
              You have read-only access to invoice records. Contact a finance administrator to make changes.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
