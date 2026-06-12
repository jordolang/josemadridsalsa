import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Activity,
  BookOpen,
  Database,
  ExternalLink,
  FileText,
  HardDrive,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  Package,
  PenSquare,
  Settings,
  Share2,
  ShoppingCart,
  Users,
} from 'lucide-react'
import prisma from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { blobUploadsConfigured } from '@/lib/blob-storage'
import { salsadocsConfigured } from '@/lib/developer/salsadocs'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createMetadata } from '@/lib/metadata'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Developer Console - Jose Madrid Salsa Admin',
  description: 'Super admin overview and platform controls.',
  pathname: '/admin/developer',
})

interface StatusCheck {
  label: string
  ok: boolean
  detail: string
}

async function getStatusChecks(): Promise<StatusCheck[]> {
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

async function getPlatformStats() {
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

async function getRecentAudit() {
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

const CONTROL_LINKS = [
  { label: 'File Explorer', href: '/admin/developer/files', icon: HardDrive, description: 'josemadridsalsa-blob storage' },
  { label: 'Developer Blog', href: '/admin/developer/blog', icon: PenSquare, description: 'Write and publish posts' },
  { label: 'Page Content', href: '/admin/developer/content', icon: FileText, description: 'Customize /developer' },
  { label: 'Salsadocs', href: '/admin/developer/salsadocs', icon: BookOpen, description: 'Publish documentation' },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart, description: 'Order management' },
  { label: 'Products', href: '/admin/products', icon: Package, description: 'Catalog management' },
  { label: 'Users', href: '/admin/users', icon: Users, description: 'Accounts and roles' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, description: 'Platform configuration' },
  { label: 'Integrations', href: '/admin/settings/integrations', icon: KeyRound, description: 'API keys and connections' },
  { label: 'Credentials Vault', href: '/admin/credentials', icon: Lock, description: 'Encrypted secrets' },
  { label: 'Email Marketing', href: '/admin/email-marketing', icon: Mail, description: 'Campaigns and templates' },
  { label: 'Social Media', href: '/admin/social', icon: Share2, description: 'Publishing and shops' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: Activity, description: 'System audit trail' },
  { label: 'Admin Dashboard', href: '/admin', icon: LayoutDashboard, description: 'Standard admin panel' },
] as const

const EXTERNAL_LINKS = [
  { label: 'Salsadocs Site', href: 'https://salsadocs.vercel.app' },
  { label: 'Salsadocs Repo', href: 'https://github.com/jordolang/salsadocs' },
  { label: 'Main Repo', href: 'https://github.com/jordolang/josemadridsalsa' },
  { label: 'Vercel Dashboard', href: 'https://vercel.com/dashboard' },
] as const

export default async function DeveloperConsolePage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'developer:system'))) {
    redirect('/admin')
  }

  const [checks, stats, audit] = await Promise.all([
    getStatusChecks(),
    getPlatformStats(),
    getRecentAudit(),
  ])

  return (
    <div className="space-y-6">
      {/* Platform stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ['Users', stats.users],
            ['Orders', stats.orders],
            ['Products', stats.products],
            ['Dev Blog Posts', stats.posts],
          ] as const
        ).map(([label, count]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {count === null ? '—' : count.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* System status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Status
            </CardTitle>
            <CardDescription>Connections and service configuration.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {checks.map((check) => (
                <li key={check.label} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium">{check.label}</span>
                  <Badge variant={check.ok ? 'default' : 'destructive'}>{check.detail}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recent audit activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest entries from the audit trail.</CardDescription>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No audit entries yet.
              </p>
            ) : (
              <ul className="divide-y text-sm">
                {audit.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-xs">{entry.action}</div>
                      {entry.entityType && (
                        <div className="truncate text-muted-foreground">
                          {entry.entityType}
                          {entry.entityId ? ` · ${entry.entityId}` : ''}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {entry.createdAt.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Control center */}
      <Card>
        <CardHeader>
          <CardTitle>Control Center</CardTitle>
          <CardDescription>
            Every part of the platform the Developer account controls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {CONTROL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
              >
                <link.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                <div>
                  <div className="font-medium">{link.label}</div>
                  <div className="text-sm text-muted-foreground">{link.description}</div>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {EXTERNAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
