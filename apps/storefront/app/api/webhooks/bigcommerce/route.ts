import { after, NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { BIGCOMMERCE_CATALOG_TAG } from '@/lib/bigcommerce/catalog'
import { mirrorBigCommerceOrder } from '@/lib/bigcommerce/orders'
import {
  BIGCOMMERCE_WEBHOOK_SECRET_HEADER,
  isValidBigCommerceWebhookSecret,
} from '@/lib/bigcommerce/webhooks'

// Hooks registered for the fundraising store carry `?store=fundraising` on their destination;
// the main store's hooks carry no query, as they always have.
const storeSchema = z.enum(['main', 'fundraising']).default('main')

const webhookSchema = z.object({
  scope: z.string().min(1),
  data: z.object({ id: z.coerce.number().int().positive() }).partial().optional(),
})

/**
 * Receives BigCommerce webhooks from both stores. A product change drops the
 * cached catalog so the next page view shows BigCommerce's current price,
 * stock and options. An order change copies that order into this site's order
 * table — from the store named by the `store` query parameter.
 */
export async function POST(request: NextRequest) {
  if (!isValidBigCommerceWebhookSecret(request.headers.get(BIGCOMMERCE_WEBHOOK_SECRET_HEADER))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const store = storeSchema.safeParse(request.nextUrl.searchParams.get('store') ?? undefined)
  const parsed = webhookSchema.safeParse(await request.json().catch(() => null))
  if (!store.success || !parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (parsed.data.scope.startsWith('store/product/')) {
    revalidateTag(BIGCOMMERCE_CATALOG_TAG, 'max')
  }

  const orderId = parsed.data.data?.id
  if (parsed.data.scope.startsWith('store/order/') && orderId) {
    // Copied after the response: BigCommerce waits only a few seconds for a 200, and the
    // hourly sweep picks up any order this attempt fails on.
    after(async () => {
      try {
        if (store.data === 'main') await mirrorBigCommerceOrder(orderId)
        else await mirrorBigCommerceOrder(orderId, { store: store.data })
      } catch (error) {
        console.error('[bigcommerce] order mirror failed', {
          store: store.data,
          orderId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })
  }

  // BigCommerce retries anything but a 2xx, and disables a hook that keeps
  // failing, so every authenticated delivery is acknowledged.
  return NextResponse.json({ ok: true })
}
