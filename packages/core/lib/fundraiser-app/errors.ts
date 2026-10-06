import { NextResponse } from 'next/server'

/**
 * A failure the app can show the seller as-is. `code` lets the app react without parsing the
 * message: `signed_out` sends it back to setup, `locked` back to the PIN pad.
 */
export class FundraiserAppError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: 'signed_out' | 'locked' | 'group_closed'
  ) {
    super(message)
    this.name = 'FundraiserAppError'
  }
}

/** Turn a mobile-app route failure into a response the app can show. */
export function fundraiserAppErrorResponse(error: unknown, context: string) {
  if (error instanceof FundraiserAppError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
  }
  console.error(`[FUNDRAISER APP] ${context}:`, error)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again in a moment.' },
    { status: 500 }
  )
}
