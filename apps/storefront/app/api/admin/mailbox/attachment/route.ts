import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { fail, failFromError } from '@/lib/api'
import { getAttachment } from '@/lib/inbox/mailbox'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  messageId: z.string().regex(/^[0-9a-f]{1,32}$/i),
  attachmentId: z.string().min(1).max(2000),
  filename: z.string().max(255).default('attachment'),
})

/**
 * GET /api/admin/mailbox/attachment — download one attachment.
 *
 * Always served as a download with a neutral type, never rendered inline: an HTML or SVG
 * attachment opened on this origin would run with the admin's session.
 */
export async function GET(req: NextRequest) {
  try {
    const { accessToken } = await openMailbox()
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return fail('Invalid attachment', 400)
    const file = await getAttachment(accessToken, parsed.data.messageId, parsed.data.attachmentId)
    const name = parsed.data.filename.replace(/[^\w.\- ]+/g, '_')
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${name}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return failFromError(error, 'Could not download the attachment')
  }
}
