/**
 * The Developer Console's overview: service checks, platform counts and the
 * latest audit entries.
 *
 * Read by `/admin/developer` and by the desktop shell's Developer page, so the
 * two cannot disagree about whether, say, Stripe is configured. Every reader
 * here degrades instead of throwing — an overview that dies because one count
 * failed tells the developer less than one that shows the gap.
 */

import prisma from '@/lib/prisma'
import { blobUploadsConfigured } from '@/lib/blob-storage'
import { salsadocsConfigured } from '@/lib/developer/salsadocs'

export interface StatusCheck {
  label: string
  ok: boolean
  detail: string
}

export async function getStatusChecks(): Promise<StatusCheck[]> {
  let databaseOk = false
  try {
    await prisma.$queryRaw`SELECT 1`
    databaseOk = true
  } catch {
    databaseOk = false
  }

  const envCheck = (label: string, ...vars: string[]): StatusCheck => {
    const ok = vars.every((name) => Boolean(process.env[name]))
    return { label, ok, detail: ok ? 'Configured' : `Missing ${vars.join(', ')}` }
  }

  return [
    { label: 'Database', ok: databaseOk, detail: databaseOk ? 'Connected' : 'Unreachable' },
    {
      label: 'Blob Store (josemadridsalsa-blob)',
      ok: blobUploadsConfigured(),
      detail: blobUploadsConfigured() ? 'Configured' : 'Missing BLOB_READ_WRITE_TOKEN',
    },
    {
      label: 'Salsadocs Publishing',
      ok: salsadocsConfigured(),
      detail: salsadocsConfigured() ? 'Configured' : 'Missing SALSADOCS_GITHUB_TOKEN',
    },
    envCheck('Auth (NextAuth)', 'NEXTAUTH_SECRET'),
    envCheck('Email (Resend)', 'RESEND_API_KEY'),
    envCheck('Stripe', 'STRIPE_SECRET_KEY'),
    envCheck('Google OAuth', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'),
    envCheck('Anthropic AI', 'ANTHROPIC_API_KEY'),
  ]
}

export async function getPlatformStats() {
  const [users, orders, products, posts] = await Promise.allSettled([
    prisma.user.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.developerBlogPost.count(),
  ])
  const value = (result: PromiseSettledResult<number>) =>
    result.status === 'fulfilled' ? result.value : null

  return {
    users: value(users),
    orders: value(orders),
    products: value(products),
    posts: value(posts),
  }
}

export async function getRecentAudit() {
  try {
    return await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
    })
  } catch {
    return []
  }
}
