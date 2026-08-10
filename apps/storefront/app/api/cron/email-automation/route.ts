import { NextRequest, NextResponse } from 'next/server'
import { processDueAutomationSteps } from '@/lib/email/automation-engine'
import { registerDomainEventConsumers } from '@/lib/domain-events/handlers'
import { dispatchPendingDomainEvents } from '@/lib/domain-events/subscribe'

/**
 * Vercel Cron, every 5 minutes.
 *
 * Two stages, in this order. Draining the event outbox is what creates enrollments; running
 * the step processor immediately afterwards means an automation whose first step has no delay
 * goes out on the same tick rather than waiting five minutes for the next one.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    registerDomainEventConsumers()

    const events = await dispatchPendingDomainEvents()
    const result = await processDueAutomationSteps()

    return NextResponse.json({ success: true, events, ...result })
  } catch (error) {
    console.error('Automation cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
