import { NextRequest, NextResponse } from 'next/server'
import { processDueAutomationSteps } from '@/lib/email/automation-engine'

// Vercel Cron: runs every minute
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processDueAutomationSteps()
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Automation cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
