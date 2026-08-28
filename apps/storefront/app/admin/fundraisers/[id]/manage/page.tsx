import { redirect, notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import { createMetadata } from '@/lib/metadata'
import FundraiserManageClient from './fundraiser-manage-client'

export const metadata: Metadata = createMetadata({
  title: 'Manage Fundraiser - Jose Madrid Salsa Admin',
  description: 'Comprehensive fundraiser management.',
  pathname: '/admin/fundraisers',
})

export default async function FundraiserManagePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user || !(await hasPermission(user, 'orders:write'))) {
    redirect('/admin/fundraisers')
  }

  const [fundraiserRaw, allProductsRaw] = await Promise.all([
    prisma.fundraiser.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                price: true,
                featuredImage: true,
                isActive: true,
              },
            },
          },
        },
        participants: {
          orderBy: { totalRevenue: 'desc' },
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            total: true,
            createdAt: true,
            participant: {
              select: { name: true },
            },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        featuredImage: true,
        isActive: true,
      },
    }),
  ])

  if (!fundraiserRaw) {
    notFound()
  }

  // Serialise Decimal / Date fields so they pass through as plain values
  const fundraiser = {
    ...fundraiserRaw,
    goal: fundraiserRaw.goal !== null ? fundraiserRaw.goal.toString() : null,
    commissionRate: fundraiserRaw.commissionRate.toString(),
    defaultUnitPrice: fundraiserRaw.defaultUnitPrice.toString(),
    totalRevenue: fundraiserRaw.totalRevenue.toString(),
    totalCommission: fundraiserRaw.totalCommission.toString(),
    startDate: fundraiserRaw.startDate.toISOString(),
    endDate: fundraiserRaw.endDate.toISOString(),
    createdAt: fundraiserRaw.createdAt.toISOString(),
    updatedAt: fundraiserRaw.updatedAt.toISOString(),
    pageConfig: (fundraiserRaw.pageConfig ?? null) as Record<string, unknown> | null,
    products: fundraiserRaw.products.map(fp => ({
      ...fp,
      price: fp.price !== null ? fp.price.toString() : null,
      createdAt: fp.createdAt.toISOString(),
      product: {
        ...fp.product,
        price: fp.product.price.toString(),
      },
    })),
    participants: fundraiserRaw.participants.map(p => ({
      ...p,
      totalRevenue: p.totalRevenue.toString(),
      totalCommission: p.totalCommission.toString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    orders: fundraiserRaw.orders.map(o => ({
      ...o,
      total: o.total.toString(),
      createdAt: o.createdAt.toISOString(),
    })),
  }

  const allProducts = allProductsRaw.map(p => ({
    ...p,
    price: p.price.toString(),
  }))

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-background to-muted/40">
      <FundraiserManageClient fundraiser={fundraiser} allProducts={allProducts} />
    </div>
  )
}
