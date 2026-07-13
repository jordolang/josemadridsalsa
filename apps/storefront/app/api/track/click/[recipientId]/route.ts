import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  const { recipientId } = await params
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate URL
  let targetUrl: string
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    targetUrl = parsed.toString()
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    await prisma.emailRecipient.updateMany({
      where: { id: recipientId, status: { in: ['SENT', 'OPENED'] } },
      data: { status: 'CLICKED', clickedAt: new Date() },
    })
  } catch {
    // Silently fail
  }

  return NextResponse.redirect(targetUrl, 302)
}
