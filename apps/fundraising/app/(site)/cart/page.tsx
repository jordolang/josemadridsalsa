import type { Metadata } from 'next'
import { FundraisingCart } from '@/components/fundraising-site/fundraising-cart'
import { getActiveFundraisingGroups } from '@/lib/fundraising-site/groups'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Your Cart',
  robots: { index: false, follow: true },
}

export default async function FundraisingCartPage() {
  const groups = await getActiveFundraisingGroups().catch(() => null)
  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-8 font-serif text-3xl font-bold text-foreground">Your cart</h1>
      <FundraisingCart groups={groups?.map((group) => group.label) ?? null} />
    </div>
  )
}
