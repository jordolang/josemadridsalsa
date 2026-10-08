// @vitest-environment node
import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'

const { createMessage } = vi.hoisted(() => ({ createMessage: vi.fn() }))

vi.mock('@/lib/rbac', () => ({ getCurrentUser: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/prisma', () => ({ default: { auditLog: { create: vi.fn() } } }))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60 }),
  getClientIdentifier: () => 'ip',
  createRateLimitHeaders: () => ({}),
  RATE_LIMITS: { AI_CHAT: {}, AI_CHAT_USER: {} },
}))
vi.mock('@/lib/ai-rag/content-cache', () => ({ getIndexedContent: vi.fn().mockResolvedValue([]) }))
vi.mock('@/lib/ai-rag/retriever', () => ({ searchContent: () => [], formatContextForLLM: () => '' }))
vi.mock('@amplitude/ai', () => ({
  Session: class {
    run<T>(fn: (s: { trackUserMessage: () => void }) => T) {
      return fn({ trackUserMessage: () => {} })
    }
  },
}))
vi.mock('@/lib/analytics/agent-analytics', () => ({
  storefrontChatAgent: {},
  trackedAnthropic: () => ({ createMessage }),
}))

process.env.ANTHROPIC_API_KEY = 'test-key'

const { POST } = await import('@/app/api/ai-chat/route')

function chat() {
  return POST(
    new Request('http://localhost/api/ai-chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }] }),
    }),
  )
}

describe('POST /api/ai-chat', () => {
  it('keeps the error status from Anthropic so the widget shows the cause', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    createMessage.mockRejectedValueOnce(
      new Anthropic.BadRequestError(400, undefined, 'Your credit balance is too low', new Headers()),
    )

    const response = await chat()

    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('credit balance is too low')
  })

  it('returns the reply on success', async () => {
    createMessage.mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hola!' }] })

    const response = await chat()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ reply: 'Hola!' })
  })
})
