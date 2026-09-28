import { notFound, permanentRedirect } from 'next/navigation'
import { getBigCommerceProducts } from '@/lib/bigcommerce/catalog'
import { isBigCommerceConfigured } from '@/lib/bigcommerce/config'
import { fundraisingProductSlug } from '@/lib/fundraising-site/catalog'
import { resolveLegacyFundraisingPath } from '@/lib/fundraising-site/legacy-redirects'

/** Old josemadridsalsafundraising.com URLs → their new homes; anything else is a 404. */
export default async function LegacyFundraisingPath({ params }: { params: Promise<{ legacy: string[] }> }) {
  const { legacy } = await params
  const products = isBigCommerceConfigured('fundraising')
    ? await getBigCommerceProducts('fundraising').catch(() => [])
    : []
  const target = resolveLegacyFundraisingPath(
    legacy.map((segment) => decodeURIComponent(segment)),
    products.map(fundraisingProductSlug),
  )
  if (!target) notFound()
  permanentRedirect(target)
}
