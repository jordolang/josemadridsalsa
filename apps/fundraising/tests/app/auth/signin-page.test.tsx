import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => searchParams.current,
}))
vi.mock('next-auth/react', () => ({ signIn: vi.fn(), getProviders: vi.fn().mockResolvedValue({}) }))

const { default: SignInPage } = await import('@/app/auth/signin/page')

describe('sign-in page', () => {
  it('says why a social sign-in failed when NextAuth sends the visitor back here', async () => {
    // Before, the page came back unchanged and the Google button looked like it did nothing.
    searchParams.current = new URLSearchParams({ error: 'OAuthCallback' })
    render(<SignInPage />)
    expect(await screen.findByText(/That sign-in did not finish/)).toBeInTheDocument()
  })

  it('shows no error on a normal visit', async () => {
    searchParams.current = new URLSearchParams({ callbackUrl: '/fundraiser-portal/dashboard' })
    render(<SignInPage />)
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByText(/Sign in failed|did not finish/)).not.toBeInTheDocument()
  })
})
