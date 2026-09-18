import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission, isStaff } from '@/lib/rbac'
import type { FormOption, OptionSource } from '@/lib/admin-desktop/forms'
import { SECTION_PERMISSION } from '@/lib/admin-desktop/access'
import type { DesktopSectionId } from '@/lib/admin-desktop/sections'

/**
 * The choices behind a picker whose options are rows rather than an enum.
 *
 * Fetched when a sheet opens rather than shipped with the page, so a product
 * list cannot be stale by the time somebody uses it.
 *
 * A picker is not protected by the form that opens it — this endpoint is
 * callable on its own — so each source is gated on the permission that guards
 * the section the rows come from. `customers` and `staff` are the sharp cases:
 * both carry email addresses, and without a gate any staff account could read
 * five hundred of them without the permission the list itself requires.
 */

export const dynamic = 'force-dynamic'

const LIMIT = 500

/**
 * The section each source's rows belong to.
 *
 * The permission itself comes from `SECTION_PERMISSION`, so a picker is gated on
 * exactly what the list it draws from is gated on and the two cannot drift
 * apart. Keyed by every source in the union, so adding one without deciding who
 * may read it is a type error rather than an open door.
 */
const SOURCE_SECTION: Record<OptionSource, DesktopSectionId> = {
  products: 'products',
  activeProducts: 'products',
  categories: 'products',
  suppliers: 'purchase',
  customers: 'customers',
  fundraisers: 'fundraisers',
  staff: 'users',
  emailTemplates: 'email',
  mailingLists: 'email',
  blogCategories: 'content',
  leadCampaigns: 'leads',
}

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

  const permission = SECTION_PERMISSION[SOURCE_SECTION[source as OptionSource]]
  if (permission && !(await hasPermission(user, permission))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
