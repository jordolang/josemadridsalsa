import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { BIGCOMMERCE_CATALOG_TAG } from '@/lib/bigcommerce/catalog'
import {
  BIGCOMMERCE_WEBHOOK_SECRET_HEADER,
  isValidBigCommerceWebhookSecret,
} from '@/lib/bigcommerce/webhooks'

const webhookSchema = z.object({
  scope: z.string().min(1),
})

/**
 * Receives BigCommerce webhooks. A product change drops the cached catalog so
 * the next page view shows BigCommerce's current price, stock and options.
 */
export async function POST(request: NextRequest) {
  if (!isValidBigCommerceWebhookSecret(request.headers.get(BIGCOMMERCE_WEBHOOK_SECRET_HEADER))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const parsed = webhookSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (parsed.data.scope.startsWith('store/product/')) {
    revalidateTag(BIGCOMMERCE_CATALOG_TAG, 'max')
  }

  // BigCommerce retries anything but a 2xx, and disables a hook that keeps
  // failing, so every authenticated delivery is acknowledged.
  return NextResponse.json({ ok: true })
}
