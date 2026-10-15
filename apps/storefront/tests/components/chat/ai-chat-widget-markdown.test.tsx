import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AiChatWidget } from '@/components/chat/ai-chat-widget'
import { ChatMarkdown } from '@/components/chat/chat-markdown'

describe('ChatMarkdown', () => {
  it('renders Markdown syntax as formatting instead of raw characters', () => {
    const { container } = render(
      <ChatMarkdown
        content={[
          '## Our flavors',
          '',
          'Try **Mild Mango** or *Hot Garlic*.',
          '',
          '- Peach Mild',
          '- Black Bean & Corn',
          '',
          '1. Pick a jar',
          '2. Check out',
          '',
          'See [our fundraising page](/fundraising) or https://www.josemadridsalsa.com.',
          '',
          '| Flavor | Heat |',
          '| --- | --- |',
          '| Mild Mango | Mild |',
        ].join('\n')}
      />
    )

    expect(container.textContent).not.toMatch(/\*\*|##|\|/)
    expect(screen.getByText('Our flavors')).toBeInTheDocument()
    expect(screen.getByText('Mild Mango', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Hot Garlic', { selector: 'em' })).toBeInTheDocument()
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'our fundraising page' })).toHaveAttribute('href', '/fundraising')
    expect(screen.getByRole('link', { name: 'https://www.josemadridsalsa.com' })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('does not render raw HTML from a reply', () => {
    const { container } = render(<ChatMarkdown content={'Hi <img src=x onerror="alert(1)"> <script>alert(1)</script>'} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('script')).toBeNull()
  })
})

describe('AiChatWidget reply formatting', () => {
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
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ reply: 'Our **best seller** is *Mild Mango*.' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('formats Picante replies as Markdown and keeps visitor messages as typed', async () => {
    render(<AiChatWidget />)
    fireEvent.click(screen.getByRole('button', { name: /chat/i }))

    fireEvent.change(screen.getByPlaceholderText(/ask about flavors/i), {
      target: { value: 'What is **popular**?' },
    })
    fireEvent.submit(screen.getByPlaceholderText(/ask about flavors/i).closest('form')!)

    expect(await screen.findByText('best seller', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Mild Mango', { selector: 'em' })).toBeInTheDocument()
    expect(screen.queryByText(/\*\*best seller\*\*/)).not.toBeInTheDocument()
    expect(screen.getByText('What is **popular**?')).toBeInTheDocument()
  })
})
