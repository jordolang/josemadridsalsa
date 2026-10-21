import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SocialLoginButtons } from '@/components/auth/social-login-buttons'

const signIn = vi.hoisted(() => vi.fn())
const getProviders = vi.hoisted(() => vi.fn())
vi.mock('next-auth/react', () => ({ signIn, getProviders }))

const oauth = (id: string) => ({ id, name: id, type: 'oauth', signinUrl: '', callbackUrl: '' })
const credentials = { id: 'credentials', name: 'Credentials', type: 'credentials', signinUrl: '', callbackUrl: '' }

describe('SocialLoginButtons', () => {
  beforeEach(() => {
    signIn.mockReset()
    getProviders.mockResolvedValue({ google: oauth('google'), github: oauth('github'), credentials })
  })

  it('returns to the page sign-in was asked for', async () => {
    render(<SocialLoginButtons callbackUrl="/fundraiser-portal/dashboard" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }))
    expect(signIn).toHaveBeenCalledWith('google', { callbackUrl: '/fundraiser-portal/dashboard' })
  })

  it('returns home when no page was asked for', async () => {
    render(<SocialLoginButtons />)
    fireEvent.click(await screen.findByRole('button', { name: 'Continue with GitHub' }))
    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/' })
  })

  it('shows only the providers the server has set up', async () => {
    // The fundraising site had no Google keys: its Google button failed on every click.
    getProviders.mockResolvedValue({ github: oauth('github'), credentials })
    render(<SocialLoginButtons />)
    expect(await screen.findByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).not.toBeInTheDocument()
  })

  it('shows no buttons or divider when only email sign-in is set up', async () => {
    getProviders.mockResolvedValue({ credentials })
    const { container } = render(<SocialLoginButtons />)
    await vi.waitFor(() => expect(getProviders).toHaveBeenCalled())
    await Promise.resolve()
    expect(container).toBeEmptyDOMElement()
  })
})
