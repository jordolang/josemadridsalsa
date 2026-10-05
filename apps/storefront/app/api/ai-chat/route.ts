import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getIndexedContent } from '@/lib/ai-rag/content-cache'
import { searchContent, formatContextForLLM } from '@/lib/ai-rag/retriever'
import { PICANTE_SYSTEM_PROMPT } from '@/lib/ai-chat/persona'
import { getCurrentUser } from '@/lib/rbac'
import { Session } from '@amplitude/ai'
import { storefrontChatAgent, trackedAnthropic } from '@/lib/analytics/agent-analytics'
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
  /** One per widget conversation; groups its turns into one Agent Analytics session. */
  sessionId: z.string().uuid().optional(),
  /** The browser's Amplitude device id when analytics is on; joins the chat to the visitor. */
  deviceId: z.string().max(200).optional(),
})

const PROVIDER = process.env.AI_CHAT_PROVIDER?.toLowerCase() ?? 'anthropic'
const BASE_SYSTEM_PROMPT = PICANTE_SYSTEM_PROMPT

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

/**
 * Claude takes the system prompt as a top-level field rather than a message, and requires the
 * conversation to open on a user turn. The widget seeds the thread with Picante's greeting, so
 * leading assistant turns are dropped here instead of being rejected by the API.
 */
function splitForAnthropic(messages: ChatMessage[]) {
  const system = messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n')

  const conversation = messages.filter((message) => message.role !== 'system')
  const firstUserIndex = conversation.findIndex((message) => message.role === 'user')

  return {
    system,
    conversation: (firstUserIndex === -1 ? [] : conversation.slice(firstUserIndex)).map((message) => ({
      role: message.role as 'user' | 'assistant',
      content: message.content,
    })),
  }
}

async function callAnthropic(
  messages: ChatMessage[],
  session: { sessionId?: string; userId?: string; deviceId?: string },
) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your environment variables.' },
      { status: 400 },
    )
  }

  const model = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5'
  const { system, conversation } = splitForAnthropic(messages)

  if (conversation.length === 0) {
    return NextResponse.json({ error: 'At least one user message is required.' }, { status: 400 })
  }

  try {
    // Each request resends the whole conversation, so input auto-tracking would re-emit every
    // earlier turn; only the newest user message is recorded.
    const latest = conversation[conversation.length - 1]
    // One widget conversation spans many requests, so a turn must not end the session: it stays
    // open and the pipeline closes it after the idle timeout. Guests are identified by device.
    const chatSession = new Session(storefrontChatAgent, {
      sessionId: session.sessionId,
      userId: session.userId,
      deviceId: session.userId ? undefined : (session.deviceId ?? session.sessionId),
      trackSessionEnd: false,
      autoFlush: true,
    })
    const message = await chatSession.run(async (s) => {
      if (latest?.role === 'user' && typeof latest.content === 'string') s.trackUserMessage(latest.content)
      return trackedAnthropic(apiKey).createMessage(
        { model, max_tokens: 600, system, messages: conversation },
        { trackInputMessages: false },
      )
    })

    // On a policy decline the response is a 200 with no usable text, so check before reading it.
    if (message.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'Picante cannot help with that one. Try rephrasing, or tap “Talk to a human.”' },
        { status: 422 },
      )
    }

    const reply = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim()

    if (!reply) {
      return NextResponse.json(
        { error: 'The AI assistant did not return a response. Try again shortly.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ reply })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: 'The AI assistant is not configured correctly. Check ANTHROPIC_API_KEY.' },
        { status: 500 },
      )
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: 'The AI assistant is busy right now. Try again in a moment.' },
        { status: 429 },
      )
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: error.message || 'Unable to reach the AI assistant right now.' },
        { status: error.status ?? 502 },
      )
    }
    throw error
  }
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

    const { messages, sessionId, deviceId } = parsed.data

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
    } else if (PROVIDER === 'openai') {
      response = await callOpenAI(chatMessages)
    } else {
      response = await callAnthropic(chatMessages, { sessionId, userId, deviceId })
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
