import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'

const signIn = vi.hoisted(() => vi.fn())
vi.mock('next-auth/react', () => ({ signIn }))

describe('SocialLoginButtons', () => {
  beforeEach(() => signIn.mockReset())

  it('returns to the page sign-in was asked for', () => {
    render(<SocialLoginButtons callbackUrl="/fundraiser-portal/dashboard" />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/fundraiser-portal/dashboard' })
  })

  it('returns home when no page was asked for', () => {
    render(<SocialLoginButtons />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue with GitHub' }))
    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/' })
  })
})
