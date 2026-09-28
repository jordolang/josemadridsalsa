import type { Metadata } from 'next'
import Link from 'next/link'
import { FundraisingProductCard } from '@/components/fundraising-site/product-card'
import { getFundraisingProducts } from '@/lib/fundraising-site/catalog'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Shop Fundraiser Salsa | Jose Madrid Salsa Fundraising' },
  description:
    'Order Jose Madrid Salsa for your group’s fundraiser. Every $10 jar sends $5 to the school, team or club you choose at checkout.',
  alternates: { canonical: '/shop' },
}

export default async function FundraisingShopPage() {
  const products = await getFundraisingProducts().catch(() => null)

  return (
    <div className="container mx-auto px-4 py-10">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="mb-4 font-serif text-3xl font-bold text-foreground lg:text-4xl">Shop</h1>
        <p className="text-lg text-muted-foreground">
          Every jar is $10, and $5 of it goes to the group you’re supporting. You’ll choose your group and enter the
          salesperson’s name in your cart. Not sure which group? <Link href="/groups" className="font-semibold text-salsa-600 underline-offset-4 hover:underline">Find it here</Link>.
        </p>
      </header>

      {products === null ? (
        <p role="alert" className="mx-auto max-w-xl rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          The shop can’t be loaded right now. Please try again in a few minutes.
        </p>
      ) : products.length === 0 ? (
        <p className="text-center text-muted-foreground">No flavors are available online right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <FundraisingProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
