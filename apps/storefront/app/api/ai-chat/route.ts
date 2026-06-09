import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getIndexedContent } from '@/lib/ai-rag/content-cache'
import { searchContent, formatContextForLLM } from '@/lib/ai-rag/retriever'
import { getCurrentUser } from '@/lib/rbac'
import prisma from '@/lib/prisma'
import {
  checkRateLimit,
  getClientIdentifier,
  createRateLimitHeaders,
  RATE_LIMITS,
} from '@/lib/rate-limiter'

export const runtime = 'nodejs' // Required for Prisma and file system access

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Zod validation schema for request
const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1, 'Message content cannot be empty'),
      })
    )
    .min(1, 'At least one message is required')
    .max(50, 'Too many messages in conversation'),
})

const PROVIDER = process.env.AI_CHAT_PROVIDER?.toLowerCase() ?? 'openai'
const BASE_SYSTEM_PROMPT =
  'You are the Jose Madrid Salsa assistant. Help customers with product questions, fundraising, wholesale partnerships, and order support. Keep answers concise and friendly, and direct users to /fundraising, /wholesale, or /contact when helpful. Use the provided context information to answer questions accurately. If you don\'t know something, say so rather than making it up.'

function withSystemPrompt(messages: ChatMessage[], context?: string): ChatMessage[] {
  const hasSystemMessage = messages.some((message) => message.role === 'system')
  
  let systemContent = BASE_SYSTEM_PROMPT
  if (context) {
    systemContent += context
  }

  if (hasSystemMessage) {
    // Replace existing system message with enhanced one
    return messages.map((msg) => 
      msg.role === 'system' ? { ...msg, content: systemContent } : msg
    )
  }
  
  return [{ role: 'system', content: systemContent }, ...messages]
}

async function callOpenAI(messages: ChatMessage[]) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY is not configured. Add it to your environment variables.' },
      { status: 400 },
    )
  }

  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 600,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        error:
          typeof error?.error?.message === 'string'
            ? error.error.message
            : 'Unable to reach OpenAI right now.',
      },
      { status: response.status },
    )
  }

  const data = await response.json()
  const reply: string | null =
    data?.choices?.[0]?.message?.content ?? null

  if (!reply) {
    return NextResponse.json(
      { error: 'OpenAI did not return a response. Try again shortly.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ reply })
}

async function callSmileyFace(messages: ChatMessage[]) {
  const apiKey = process.env.SMILEYFACE_API_KEY
  const baseUrl = process.env.SMILEYFACE_API_BASE ?? 'https://api.smileyface.ai/v1'

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SMILEYFACE_API_KEY is not configured. Add it to your environment variables.' },
      { status: 400 },
    )
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      brand: 'Jose Madrid Salsa',
      messages,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    return NextResponse.json(
      {
        error:
          typeof error?.message === 'string'
            ? error.message
            : 'Unable to reach SmileyFace AI right now.',
      },
      { status: response.status },
    )
  }

  const data = await response.json()
  const reply: string | null = data?.reply ?? data?.data?.reply ?? null

  if (!reply) {
    return NextResponse.json(
      { error: 'SmileyFace AI did not return a response. Try again shortly.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ reply })
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    // Authentication check - Allow both authenticated and guest users
    // For rate limiting and usage tracking, we'll identify users
    const user = await getCurrentUser()
    const userId = user?.id
    const userEmail = user?.email

    // Rate limiting - Different limits for authenticated vs guest users
    const rateLimitConfig = user ? RATE_LIMITS.AI_CHAT_USER : RATE_LIMITS.AI_CHAT
    const identifier = userId || getClientIdentifier(request)

    const rateLimitResult = await checkRateLimit({
      ...rateLimitConfig,
      identifier: `ai-chat:${identifier}`,
    })

    // Add rate limit headers to all responses
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult)

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again in ${rateLimitResult.resetIn} seconds.`,
          retryAfter: rateLimitResult.resetIn,
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders,
            'Retry-After': rateLimitResult.resetIn.toString(),
          },
        }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { messages } = parsed.data

    // Get the latest user message for RAG retrieval
    const userMessages = messages.filter((m) => m.role === 'user')
    const latestQuery = userMessages[userMessages.length - 1]?.content || ''

    // Retrieve relevant context using RAG
    let context = ''
    try {
      const allContent = await getIndexedContent()
      const relevant = searchContent(latestQuery, allContent, 5)
      context = formatContextForLLM(relevant)
    } catch (ragError) {
      console.error('[RAG_ERROR]', ragError)
      // Continue without context if RAG fails
    }

    const chatMessages = withSystemPrompt(
      messages.filter((message) => message.content.trim().length > 0),
      context
    )

    // Call AI provider
    let response: NextResponse
    if (PROVIDER === 'smileyface') {
      response = await callSmileyFace(chatMessages)
    } else {
      response = await callOpenAI(chatMessages)
    }

    // Log AI chat usage for analytics and rate limiting
    const responseTime = Date.now() - startTime
    const responseData = await response.clone().json()
    const success = !responseData.error

    // Audit logging - Track AI chat usage
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: 'AI_CHAT',
          entityType: 'AI_ASSISTANT',
          entityId: null,
          changes: {
            provider: PROVIDER,
            messageCount: messages.length,
            userQuery: userMessages[userMessages.length - 1]?.content.substring(0, 200) || '',
            success,
            responseTimeMs: responseTime,
            userEmail: userEmail || 'guest',
            hasContext: context.length > 0,
          },
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error('[AI_CHAT] Audit logging failed:', auditError)
    }

    console.log('[AI_CHAT] Request completed:', {
      provider: PROVIDER,
      userId: userId || 'guest',
      success,
      responseTimeMs: responseTime,
      messageCount: messages.length,
      rateLimitRemaining: rateLimitResult.remaining,
    })

    // Return response with rate limit headers
    return NextResponse.json(responseData, {
      headers: rateLimitHeaders,
    })
  } catch (error) {
    console.error('[AI_CHAT_ERROR]', error)

    // Log failed request
    const responseTime = Date.now() - startTime
    try {
      const user = await getCurrentUser()
      await prisma.auditLog.create({
        data: {
          userId: user?.id || null,
          action: 'AI_CHAT',
          entityType: 'AI_ASSISTANT',
          entityId: null,
          changes: {
            provider: PROVIDER,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            responseTimeMs: responseTime,
            userEmail: user?.email || 'guest',
          },
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
        },
      })
    } catch (auditError) {
      console.error('[AI_CHAT] Error logging failed:', auditError)
    }

    return NextResponse.json(
      { error: 'Something went wrong while contacting the AI assistant. Please try again later.' },
      { status: 500 },
    )
  }
}
