import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'

const fetchMock = vi.fn()

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  })
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) })
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function openWidget() {
  render(<AiChatWidget />)
  fireEvent.click(screen.getByRole('button', { name: /chat/i }))
}

describe('AiChatWidget contact form', () => {
  it('shows the contact form call to action under the initial message', () => {
    openWidget()

    expect(
      screen.getByRole('button', { name: /or fill out a contact form by clicking here/i })
    ).toBeInTheDocument()
  })

  it('submits the contact form to the contact email endpoint', async () => {
    openWidget()

    fireEvent.click(screen.getByRole('button', { name: /or fill out a contact form by clicking here/i }))

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Annette Osinski' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'annette@example.com' } })
    fireEvent.change(screen.getByLabelText(/company name/i), { target: { value: 'Center Stage Dance Studio' } })
    fireEvent.change(screen.getByLabelText(/phone number/i), { target: { value: '716-907-3301' } })
    fireEvent.change(screen.getByLabelText(/comments \/ questions/i), {
      target: { value: 'I would like to do your fundraiser.' },
    })

    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/send-email/contact',
        expect.objectContaining({ method: 'POST' })
      )
    })

    const call = fetchMock.mock.calls.find(([url]) => url === '/api/send-email/contact')
    expect(JSON.parse(call![1].body)).toMatchObject({
      name: 'Annette Osinski',
      email: 'annette@example.com',
      company: 'Center Stage Dance Studio',
      phone: '716-907-3301',
      message: 'I would like to do your fundraiser.',
      sourcePage: 'Picante Chat',
    })

    expect(await screen.findByText(/message sent!/i)).toBeInTheDocument()
  })

  it('returns to the chat when the confirmation is closed', async () => {
    openWidget()

    fireEvent.click(screen.getByRole('button', { name: /or fill out a contact form by clicking here/i }))
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Annette Osinski' } })
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'annette@example.com' } })
    fireEvent.change(screen.getByLabelText(/comments \/ questions/i), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /send message/i }))

    fireEvent.click(await screen.findByRole('button', { name: /^close$/i }))

    // Reopening must land back on Picante, not on the confirmation screen.
    fireEvent.click(screen.getByRole('button', { name: /chat/i }))

    expect(screen.queryByText(/message sent!/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /or fill out a contact form by clicking here/i })
    ).toBeInTheDocument()
  })
})
