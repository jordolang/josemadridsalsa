import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/rbac'
import {
  checkRateLimit,
  createRateLimitHeaders,
  getClientIdentifier,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

export const runtime = 'nodejs'

type Params = { params: Promise<{ threadId: string }> }

const STAFF_ROLES = ['ADMIN', 'STAFF', 'DEVELOPER'] as const
function isStaffRole(role: string | undefined | null): boolean {
  return Boolean(role && (STAFF_ROLES as readonly string[]).includes(role))
}

const PostSchema = z.object({
  content: z.string().trim().min(1).max(4000),
})

export async function GET(request: Request, { params }: Params) {
  const { threadId } = await params
  const url = new URL(request.url)
  const since = url.searchParams.get('since')

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      status: true,
      customerUserId: true,
      assignedAdminId: true,
      customerName: true,
      customerEmail: true,
      startedAt: true,
      lastMessageAt: true,
    },
  })
  if (!thread) return NextResponse.json({ error: 'Thread not found.' }, { status: 404 })

  const viewer = await getCurrentUser()
  const isStaff = isStaffRole(viewer?.role as string | undefined)
  const isCustomer = thread.customerUserId && viewer?.id === thread.customerUserId
  // Allow unauth customer if they have the threadId (token-style access); we
  // don't expose more than messages + status.
  if (!isStaff && !isCustomer) {
    // OK — anonymous customer w/ thread id can read their own thread.
  }

  const messages = await prisma.chatHandoffMessage.findMany({
    where: {
      threadId,
      ...(since ? { createdAt: { gt: new Date(since) } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      senderType: true,
      senderLabel: true,
      content: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    thread: {
      id: thread.id,
      status: thread.status,
      assignedAdminId: isStaff ? thread.assignedAdminId : undefined,
      customerName: thread.customerName,
      customerEmail: isStaff ? thread.customerEmail : undefined,
      startedAt: thread.startedAt.toISOString(),
      lastMessageAt: thread.lastMessageAt.toISOString(),
    },
    messages: messages.map((m) => ({
      id: m.id,
      senderType: m.senderType,
      senderLabel: m.senderLabel,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  })
}

export async function POST(request: Request, { params }: Params) {
  const { threadId } = await params
  const identifier = getClientIdentifier(request)
  const rateLimit = checkRateLimit({
    ...RATE_LIMITS.API_GENERAL,
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `chat-msg:${identifier}:${threadId}`,
  })
  const headers = createRateLimitHeaders(rateLimit)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Slow down a bit.' },
      { status: 429, headers: { ...headers, 'Retry-After': rateLimit.resetIn.toString() } },
    )
  }

  const thread = await prisma.chatThread.findUnique({
    where: { id: threadId },
    select: { id: true, status: true, customerUserId: true },
  })
  if (!thread) return NextResponse.json({ error: 'Thread not found.' }, { status: 404, headers })
  if (thread.status === 'CLOSED') {
    return NextResponse.json({ error: 'This chat is closed.' }, { status: 409, headers })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers })
  }
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Message is empty or too long.' }, { status: 400, headers })
  }

  const viewer = await getCurrentUser()
  const isStaff = isStaffRole(viewer?.role as string | undefined)

  const senderType = isStaff ? 'ADMIN' : 'CUSTOMER'
  const senderUserId = viewer?.id ?? null
  const senderLabel = isStaff ? viewer?.name ?? viewer?.email ?? 'Team' : null

  const [message] = await prisma.$transaction([
    prisma.chatHandoffMessage.create({
      data: {
        threadId,
        senderType,
        senderUserId,
        senderLabel,
        content: parsed.data.content,
      },
      select: {
        id: true,
        senderType: true,
        senderLabel: true,
        content: true,
        createdAt: true,
      },
    }),
    prisma.chatThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
        // First admin message claims & activates the thread.
        ...(isStaff && thread.status !== 'ACTIVE'
          ? { status: 'ACTIVE', assignedAdminId: senderUserId }
          : {}),
      },
    }),
  ])

  return NextResponse.json(
    {
      message: {
        id: message.id,
        senderType: message.senderType,
        senderLabel: message.senderLabel,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    },
    { headers },
  )
}
