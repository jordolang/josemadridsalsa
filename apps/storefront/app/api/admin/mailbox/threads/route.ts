import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok, fail, failFromError } from '@/lib/api'
import { listThreads } from '@/lib/inbox/mailbox'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  label: z.string().max(200).optional(),
  q: z.string().max(500).optional(),
  pageToken: z.string().max(500).optional(),
})

/** GET /api/admin/mailbox/threads?label=INBOX&q=…&pageToken=… */
export async function GET(req: NextRequest) {
  try {
    const { accessToken } = await openMailbox()
    const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) return fail('Invalid query', 400, parsed.error.flatten())
    const { label, q, pageToken } = parsed.data
    return ok(await listThreads(accessToken, { labelId: label || undefined, q: q || undefined, pageToken }))
  } catch (error) {
    return failFromError(error, 'Could not list conversations')
  }
}
