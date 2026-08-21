import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { PicanteChatLauncher } from '@/components/chat/picante-chat-launcher'

const matchMedia = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  matchMedia.mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PicanteChatLauncher', () => {
  it('uses Picante as the chat control and opens the existing chat callback', () => {
    const onToggle = vi.fn()

    render(<PicanteChatLauncher isOpen={false} onToggle={onToggle} />)
    const launcher = screen.getByRole('button', { name: 'Chat with Picante' })

    fireEvent.click(launcher)

    expect(onToggle).toHaveBeenCalledOnce()
    expect(launcher).toHaveAttribute('data-direction', 'left')
  })

  it('paces in the opposite direction after crossing the bottom track', () => {
    render(<PicanteChatLauncher isOpen={false} onToggle={vi.fn()} />)
    const launcher = screen.getByRole('button', { name: 'Chat with Picante' })

    expect(launcher).toHaveAttribute('data-position', 'left')
    act(() => vi.advanceTimersByTime(8000))
    expect(launcher).toHaveAttribute('data-direction', 'right')
    expect(launcher).toHaveAttribute('data-position', 'right')
  })

  it('stays idle when chat is open or reduced motion is requested', () => {
    matchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    const { rerender } = render(<PicanteChatLauncher isOpen={false} onToggle={vi.fn()} />)
    const launcher = screen.getByRole('button', { name: 'Chat with Picante' })
    expect(launcher).toHaveAttribute('data-direction', 'idle')
    expect(launcher).toHaveAttribute('data-position', 'right')

    rerender(<PicanteChatLauncher isOpen onToggle={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Close chat window' })).toHaveAttribute(
      'data-direction',
      'idle',
    )
  })
})
