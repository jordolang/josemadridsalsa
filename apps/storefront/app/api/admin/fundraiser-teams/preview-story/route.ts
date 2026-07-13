import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdminSession } from '@/lib/admin-auth'
import { sanitizeStoryHtml } from '@/lib/sanitize-story'

const bodySchema = z.object({
  html: z.string().max(50_000),
})

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  return NextResponse.json({ html: sanitizeStoryHtml(parsed.data.html) })
}
