import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[Fundraiser Contact Form]', body)
    // TODO: integrate with email provider (resend/nodemailer)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 })
  }
}
