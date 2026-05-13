import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import { isBusinessHours } from '@/lib/chat/business-hours'
import { notifyAdminsOfHandoff } from '@/lib/chat/notify'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

export const runtime = 'nodejs'

const Schema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
  transcript: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(50)
    .optional(),
  source: z.string().trim().max(120).optional(),
})

export async function POST(request: Request) {
  const identifier = getClientIdentifier(request)
  const rateLimit = checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 5,
    windowSeconds: 60,
    identifier: `chat-handoff-request:${identifier}`,
  })
  const headers = createRateLimitHeaders(rateLimit)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again shortly.' },
      { status: 429, headers: { ...headers, 'Retry-After': rateLimit.resetIn.toString() } },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid handoff data.', details: parsed.error.flatten() },
      { status: 400, headers },
    )
  }

  const open = isBusinessHours()
  const user = await getCurrentUser()
  const name = parsed.data.name?.trim() || user?.name || null
  const email = parsed.data.email?.trim() || user?.email || null
  const status = open ? 'WAITING' : 'OFFLINE'

  if (!open && !email && !parsed.data.message) {
    return NextResponse.json(
      { error: "We're outside business hours. Please leave an email or short message so we can follow up." },
      { status: 400, headers },
    )
  }

  const thread = await prisma.chatThread.create({
    data: {
      status,
      source: parsed.data.source ?? null,
      customerName: name,
      customerEmail: email,
      customerUserId: user?.id ?? null,
      ipAddress: identifier,
      userAgent: request.headers.get('user-agent'),
    },
    select: { id: true, status: true },
  })

  const seedMessages: Array<{
    senderType: 'CUSTOMER' | 'AI' | 'SYSTEM'
    content: string
    senderLabel?: string
  }> = []

  for (const entry of parsed.data.transcript ?? []) {
    if (entry.role === 'system') continue
    seedMessages.push({
      senderType: entry.role === 'user' ? 'CUSTOMER' : 'AI',
      content: entry.content.slice(0, 4000),
      senderLabel: entry.role === 'user' ? name ?? undefined : 'AI assistant',
    })
  }
  if (parsed.data.message) {
    seedMessages.push({ senderType: 'CUSTOMER', content: parsed.data.message.slice(0, 2000), senderLabel: name ?? undefined })
  }
  seedMessages.push({
    senderType: 'SYSTEM',
    content: open
      ? 'Visitor requested to speak with a human. Waiting for an agent.'
      : "Visitor requested a human outside business hours. We'll follow up by email.",
  })

  if (seedMessages.length > 0) {
    await prisma.chatMessage.createMany({
      data: seedMessages.map((m) => ({
        threadId: thread.id,
        senderType: m.senderType,
        senderLabel: m.senderLabel ?? null,
        content: m.content,
      })),
    })
  }

  // Fire-and-forget notification.
  notifyAdminsOfHandoff({
    threadId: thread.id,
    customerName: name,
    customerEmail: email,
    preview: parsed.data.message ?? parsed.data.transcript?.slice(-1)[0]?.content ?? null,
    source: parsed.data.source ?? null,
    offline: !open,
  }).catch((error) => console.error('[chat-handoff] notify failed', error))

  return NextResponse.json(
    { threadId: thread.id, status: thread.status, businessHoursOpen: open },
    { headers },
  )
}
