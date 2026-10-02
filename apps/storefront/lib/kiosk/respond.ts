import { NextResponse } from 'next/server'
import { KioskAuthError } from '@/lib/kiosk/auth'
import { TerminalCheckoutError } from '@/lib/pos/terminal-checkout'

/** Turn a kiosk route failure into a response the kiosk screen can show. */
export function kioskErrorResponse(error: unknown, context: string) {
  if (error instanceof KioskAuthError) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }
  if (error instanceof TerminalCheckoutError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  console.error(`[KIOSK] ${context}:`, error)
  return NextResponse.json({ error: 'Something went wrong. Please ask a team member for help.' }, { status: 500 })
}
