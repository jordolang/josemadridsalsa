import { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fulfillMerchOrder, type MerchFulfillmentResult } from '@/lib/merchandise/orders'
import { merchContactEmail } from '@/lib/merchandise/config'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thanks for your order - Jose Madrid Salsa',
  robots: { index: false, follow: false },
}

type PageProps = { searchParams: Promise<{ ref?: string | string[] }> }

const REF_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Where Square sends the buyer after paying for merch. Sending the order to Printify here
 * means it usually starts printing straight away; the merch-orders cron covers buyers who
 * never arrive.
 */
export default async function MerchOrderCompletePage({ searchParams }: PageProps) {
  const { ref } = await searchParams
  const merchOrderId = typeof ref === 'string' && REF_PATTERN.test(ref) ? ref : null

  let result: MerchFulfillmentResult = { status: 'not-found' }
  if (merchOrderId) {
    try {
      result = await fulfillMerchOrder(merchOrderId)
    } catch (error) {
      console.error('Merch order completion failed', { merchOrderId, error })
      result = { status: 'processing' }
    }
  }

  const confirmed = result.status === 'submitted' || result.status === 'processing' || result.status === 'failed'

  return (
    <main className="bg-background">
      <div className="container mx-auto max-w-2xl px-4 py-16 text-center space-y-6">
        {confirmed ? (
          <CheckCircle className="mx-auto h-14 w-14 text-green-600" />
        ) : (
          <Clock className="mx-auto h-14 w-14 text-salsa-500" />
        )}
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
          {confirmed ? 'Thanks for your order!' : 'We are confirming your payment'}
        </h1>
        <p className="text-base text-muted-foreground">
          {confirmed
            ? 'Your merch is being printed just for you. You will get an email with tracking as soon as it ships.'
            : 'If you completed payment, your order will be sent to our print partner within a few minutes and you will get a receipt from Square by email.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Questions about your order? Email{' '}
          <a className="underline" href={`mailto:${merchContactEmail}`}>
            {merchContactEmail}
          </a>
          .
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/merchandise">Back to merch</Link>
          </Button>
          <Button asChild className="bg-salsa-600 text-white hover:bg-salsa-700">
            <Link href="/salsas">Shop salsa</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
