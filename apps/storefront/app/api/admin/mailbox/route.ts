import { NextRequest } from 'next/server'
import { z } from 'zod'

import { ok, fail, failFromError } from '@/lib/api'
import { createLabel, listLabels } from '@/lib/inbox/mailbox'
import { openMailbox } from '@/lib/inbox/mailbox-session'

export const dynamic = 'force-dynamic'

/** GET /api/admin/mailbox — the connected address and its folders with counts. */
export async function GET() {
  try {
    const { connection, accessToken } = await openMailbox()
    return ok({ mailbox: connection.mailbox, labels: await listLabels(accessToken) })
  } catch (error) {
    return failFromError(error, 'Could not read the mailbox')
  }
}

const CreateLabelSchema = z.object({ name: z.string().trim().min(1).max(225) })

/** POST /api/admin/mailbox — create a folder (Gmail label). */
export async function POST(req: NextRequest) {
  try {
    const { accessToken } = await openMailbox()
    const parsed = CreateLabelSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return fail('Invalid folder name', 400, parsed.error.flatten())
    return ok(await createLabel(accessToken, parsed.data.name), 201)
  } catch (error) {
    return failFromError(error, 'Could not create the folder')
  }
}
