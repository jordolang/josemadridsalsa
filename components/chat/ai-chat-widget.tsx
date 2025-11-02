'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, MessageCircle, Send, Sparkles, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'assistant-welcome',
  role: 'assistant',
  content:
    "Hi there! I'm the Jose Madrid Salsa assistant. Ask about flavors, fundraising, wholesale orders, or anything else you need.",
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const handleToggle = () => {
    setIsOpen((prev) => !prev)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data?.error === 'string' && data.error.length
            ? data.error
            : 'The assistant is unavailable right now.',
        )
      }

      const data = await response.json()
      const reply: string = data?.reply ?? 'Sorry, I could not generate a response.'
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: reply,
        },
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'The assistant is unavailable right now.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <div className="w-[340px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-3xl border border-salsa-100 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="flex items-center justify-between bg-gradient-to-r from-salsa-600 via-salsa-500 to-chile-500 px-4 py-3 text-white">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/80">AI assistant</p>
              <p className="flex items-center gap-2 text-base font-semibold">
                <Sparkles className="h-4 w-4" />
                Chat with Jose Madrid Salsa
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-full p-1 transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-salsa-600"
              aria-label="Close chat panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-[360px] flex-col justify-between">
            <div className="space-y-3 overflow-y-auto px-4 py-4 text-sm text-slate-700">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-salsa-600 text-white shadow-md'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {message.role === 'assistant' ? (
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <Bot className="h-3.5 w-3.5" />
                        Jose Madrid Salsa
                      </div>
                    ) : null}
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                  </div>
                </div>
              ))}
              {isLoading ? (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-xs text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Typing…
                  </div>
                </div>
              ) : null}
              <div ref={endRef} />
            </div>

            <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white px-4 py-3">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about flavors, fundraising, or order support..."
                rows={2}
                maxLength={600}
                className="resize-none bg-slate-50"
              />
              {error ? (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  Powered by {process.env.NEXT_PUBLIC_AI_CHAT_PROVIDER ?? 'OpenAI'} • Please avoid sharing sensitive info.
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <Button
                  type="submit"
                  className="bg-salsa-600 hover:bg-salsa-700"
                  disabled={isLoading || !input.trim()}
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  {isLoading ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleToggle}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-salsa-600 text-white shadow-lg transition hover:bg-salsa-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-salsa-500"
        aria-label={isOpen ? 'Close chat window' : 'Open chat window'}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  )
}
