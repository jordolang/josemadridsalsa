import { Metadata } from 'next'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { BrandKitClient } from './BrandKitClient'

export const metadata: Metadata = { title: 'Brand Kit - Admin' }

export default async function BrandKitPage() {
  const user = await getCurrentUser()
  if (!user || !(await hasPermission(user, 'settings:read'))) redirect('/admin')

  const brandKit = await prisma.brandKit.findFirst()

  // Transform Prisma JsonValue to Record<string, string> for type safety
  const transformedBrandKit = brandKit
    ? {
        ...brandKit,
        socialLinks:
          brandKit.socialLinks &&
          typeof brandKit.socialLinks === 'object' &&
          !Array.isArray(brandKit.socialLinks)
            ? (brandKit.socialLinks as Record<string, string>)
            : null,
      }
    : null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Kit</h1>
        <p className="text-muted-foreground">Set your brand colors, logo, and social links used in all email templates.</p>
      </div>
      <BrandKitClient initialData={transformedBrandKit} />
    </div>
  )
}
