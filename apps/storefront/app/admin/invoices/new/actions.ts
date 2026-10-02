'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { logAudit } from '@/lib/audit'
import { createInvoice, createInvoiceFormSchema } from '@/lib/invoices/create-invoice'

export type CreateInvoiceState = {
  message?: string
  /** Keyed by field path, e.g. `dueDate` or `lines.0.quantity`. */
  errors?: Record<string, string>
}

function parseLines(raw: FormDataEntryValue | null): unknown {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function createInvoiceAction(
  _state: CreateInvoiceState,
  formData: FormData,
): Promise<CreateInvoiceState> {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'financials:write'))) {
    return { message: 'You do not have permission to create invoices.' }
  }

  const parsed = createInvoiceFormSchema.safeParse({
    number: formData.get('number') ?? undefined,
    customerId: formData.get('customerId') ?? undefined,
    status: formData.get('status'),
    dueDate: formData.get('dueDate'),
    notes: formData.get('notes') ?? undefined,
    lines: parseLines(formData.get('lines')),
  })

  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form'
      errors[key] ??= issue.message
    }
    return { message: 'Fix the highlighted fields.', errors }
  }

  const values = parsed.data
  if (values.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: values.customerId }, select: { id: true } })
    if (!customer) return { errors: { customerId: 'That customer no longer exists.' } }
  }

  let invoice: { id: string; number: string }
  try {
    invoice = await createInvoice(values)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { errors: { number: 'Another invoice already uses that number.' } }
    }
    console.error('[admin/invoices] create failed:', error)
    return { message: 'That invoice could not be created.' }
  }

  await logAudit({
    userId: user.id,
    action: 'create',
    entityType: 'Invoice',
    entityId: invoice.id,
    changes: { ...values, number: invoice.number },
  })

  revalidatePath('/admin/invoices')
  redirect(`/admin/invoices/${invoice.id}`)
}
