import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { FeaturedFundraisingProducts } from '@/components/fundraising-site/featured-products'
import { SupportGroupButton } from '@/components/fundraising-site/support-group-button'
import { formatPrice } from '@/components/fundraising-site/product-card'
import { getGroupProgress } from '@/lib/fundraising-site/group-progress'
import { getActiveFundraisingGroup, getActiveFundraisingGroups } from '@/lib/fundraising-site/groups'

export const revalidate = 300

type Params = { slug: string }

export async function generateStaticParams(): Promise<Params[]> {
  const groups = await getActiveFundraisingGroups().catch(() => [])
  return groups.map((group) => ({ slug: group.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const group = await getActiveFundraisingGroup(slug).catch(() => null)
  if (!group) return {}
  return {
    title: `Support ${group.label}`,
    description: `Order Jose Madrid Salsa to support ${group.label}. Every $10 jar sends $5 to the group, shipped to your door.`.slice(0, 160),
    alternates: { canonical: `/groups/${group.slug}` },
  }
}

export default async function GroupPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const group = await getActiveFundraisingGroup(slug)
  if (!group) notFound()
  const progress = await getGroupProgress(group.label)

  return (
    <div>
      <section className="bg-gradient-to-r from-verde-600 via-salsa-600 to-chile-600 text-white">
        <div className="container mx-auto px-4 py-14 text-center">
          <Link href="/groups" className="mb-6 inline-flex items-center text-sm text-white/80 hover:text-white">
            <ChevronLeft className="mr-1 h-4 w-4" aria-hidden />
            All groups
          </Link>
          <h1 className="mb-4 font-serif text-3xl font-bold lg:text-5xl">{group.label}</h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90">
            Every $10 jar of Jose Madrid Salsa you order sends $5 to {group.label}. Orders ship straight to your door.
          </p>
          {progress && (
            <p className="mx-auto mb-8 inline-block rounded-full bg-white/15 px-5 py-2 font-semibold">
              {progress.orders} {progress.orders === 1 ? 'order' : 'orders'} so far · {formatPrice(progress.earned)} earned for the group
            </p>
          )}
          <div>
            <SupportGroupButton group={group.label} />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="mb-2 text-center font-serif text-2xl font-bold text-foreground">Popular flavors</h2>
        <p className="mb-8 text-center text-muted-foreground">
          At checkout, choose <strong>{group.label}</strong> and enter the name of the person who asked you to buy.
        </p>
        <FeaturedFundraisingProducts limit={8} />
        <div className="mt-8 text-center">
          <SupportGroupButton group={group.label} size="sm" />
        </div>
      </section>
    </div>
  )
}
