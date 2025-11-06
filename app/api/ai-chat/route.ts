import { NextResponse } from 'next/server'
import { indexAllContent } from '@/lib/ai-rag/indexer'
import { searchContent, formatContextForLLM } from '@/lib/ai-rag/retriever'

export const runtime = 'nodejs' // Required for Prisma and file system access

type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type ChatRequest = {
  messages: ChatMessage[]
}

const PROVIDER = process.env.AI_CHAT_PROVIDER?.toLowerCase() ?? 'openai'
const BASE_SYSTEM_PROMPT =
  'You are the Jose Madrid Salsa assistant. Help customers with product questions, fundraising, wholesale partnerships, and order support. Keep answers concise and friendly, and direct users to /fundraising, /wholesale, or /contact when helpful. Use the provided context information to answer questions accurately. If you don\'t know something, say so rather than making it up.'

// Cache for indexed content (refresh every 5 minutes)
let contentCache: { content: Awaited<ReturnType<typeof indexAllContent>>; timestamp: number } | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getIndexedContent() {
  const now = Date.now()
  if (contentCache && now - contentCache.timestamp < CACHE_TTL) {
    return contentCache.content
  }

  const content = await indexAllContent()
  contentCache = { content, timestamp: now }
  return content
}

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
  try {
    const body = (await request.json()) as ChatRequest
    const messages = Array.isArray(body?.messages) ? body.messages : []

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Include at least one user message.' }, { status: 400 })
    }

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

    if (PROVIDER === 'smileyface') {
      return callSmileyFace(chatMessages)
    }

    return callOpenAI(chatMessages)
  } catch (error) {
    console.error('[AI_CHAT_ERROR]', error)
    return NextResponse.json(
      { error: 'Something went wrong while contacting the AI assistant. Please try again later.' },
      { status: 500 },
    )
  }
}
