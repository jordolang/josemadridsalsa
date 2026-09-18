import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, isStaff } from '@/lib/rbac'
import type { FormOption, OptionSource } from '@/lib/admin-desktop/forms'

/**
 * The choices behind a picker whose options are rows rather than an enum.
 *
 * Fetched when a sheet opens rather than shipped with the page, so a product
 * list cannot be stale by the time somebody uses it. Everything returned here is
 * a name and an id the operator could already read in the section they came
 * from, which is why one staff gate is the whole check: there is no field below
 * that a staff account cannot already see in the list it belongs to.
 */

export const dynamic = 'force-dynamic'

const LIMIT = 500

const SOURCES: Record<OptionSource, () => Promise<FormOption[]>> = {
  products: async () => {
    const rows = await prisma.product.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: LIMIT,
      select: { id: true, name: true, sku: true, price: true, isActive: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.isActive ? row.name : `${row.name} (retired)`,
      hint: `${row.sku} · $${Number(row.price).toFixed(2)}`,
    }))
  },

  activeProducts: async () => {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, sku: true, price: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.name,
      hint: `${row.sku} · $${Number(row.price).toFixed(2)}`,
    }))
  },

  categories: async () => {
    const rows = await prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: LIMIT,
      select: { id: true, name: true },
    })
    return rows.map((row) => ({ value: row.id, label: row.name }))
  },

  suppliers: async () => {
    const rows = await prisma.supplier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      take: LIMIT,
      select: { id: true, name: true, city: true, state: true, isActive: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.isActive ? row.name : `${row.name} (inactive)`,
      hint: [row.city, row.state].filter(Boolean).join(', ') || undefined,
    }))
  },

  customers: async () => {
    const rows = await prisma.customer.findMany({
      orderBy: [{ lastOrderAt: 'desc' }, { email: 'asc' }],
      take: LIMIT,
      select: { id: true, email: true, firstName: true, lastName: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: [row.firstName, row.lastName].filter(Boolean).join(' ') || row.email,
      hint: row.email,
    }))
  },

  fundraisers: async () => {
    const rows = await prisma.fundraiser.findMany({
      orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
      take: LIMIT,
      select: { id: true, name: true, organizationName: true, status: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.name,
      hint: `${row.organizationName} · ${row.status.toLowerCase()}`,
    }))
  },

  staff: async () => {
    const rows = await prisma.user.findMany({
      where: { role: { in: ['DEVELOPER', 'ADMIN', 'STAFF'] } },
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, email: true },
    })
    return rows.map((row) => ({ value: row.id, label: row.name ?? row.email, hint: row.email }))
  },

  emailTemplates: async () => {
    const rows = await prisma.emailTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, subject: true },
    })
    return rows.map((row) => ({ value: row.id, label: row.name, hint: row.subject }))
  },

  mailingLists: async () => {
    const rows = await prisma.mailingList.findMany({
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true, _count: { select: { subscribers: true } } },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.name,
      hint: `${row._count.subscribers.toLocaleString('en-US')} subscribers`,
    }))
  },

  blogCategories: async () => {
    const rows = await prisma.blogCategory.findMany({
      orderBy: { name: 'asc' },
      take: LIMIT,
      select: { id: true, name: true },
    })
    return rows.map((row) => ({ value: row.id, label: row.name }))
  },

  leadCampaigns: async () => {
    const rows = await prisma.leadCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: LIMIT,
      select: { id: true, name: true, city: true, state: true },
    })
    return rows.map((row) => ({
      value: row.id,
      label: row.name,
      hint: [row.city, row.state].filter(Boolean).join(', ') || undefined,
    }))
  },
}

export async function GET(_request: Request, context: { params: Promise<{ source: string }> }) {
  const user = await getCurrentUser()
  if (!user || !isStaff(user)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { source } = await context.params
  const load = SOURCES[source as OptionSource]
  if (!load) {
    return NextResponse.json({ error: 'Unknown option source' }, { status: 404 })
  }

  try {
    return NextResponse.json({ options: await load() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(`[admin-desktop] options ${source} failed:`, error)
    // An empty list is a workable answer: the sheet says the picker is empty
    // rather than refusing to open over a list it could not build.
    return NextResponse.json({ options: [] })
  }
}
