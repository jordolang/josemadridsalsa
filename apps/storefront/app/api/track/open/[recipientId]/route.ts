import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 1x1 transparent GIF
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ recipientId: string }> }
) {
  const { recipientId } = await params

  try {
    // Update recipient open status (only first open counts)
    await prisma.emailRecipient.updateMany({
      where: { id: recipientId, status: 'SENT', openedAt: null },
      data: { status: 'OPENED', openedAt: new Date() },
    })
  } catch {
    // Silently fail - never block the tracking pixel
  }

  return new NextResponse(TRACKING_PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  })
}
