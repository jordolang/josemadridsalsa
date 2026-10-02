import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FundraiserAccountForm } from '@/components/fundraising/fundraiser-account-form'

const assign = vi.fn()

afterEach(() => {
  vi.unstubAllGlobals()
  assign.mockReset()
})

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText('Organization Name'), { target: { value: 'Band Boosters' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret-pass' } })
  fireEvent.click(screen.getByRole('button', { name: /create fundraiser account/i }))
}

describe('FundraiserAccountForm', () => {
  it('sends the new account to the portal on the main site when rendered on another host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('location', { ...window.location, assign })
    render(<FundraiserAccountForm siteUrl="https://www.josemadrid.net" />)

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', 'https://www.josemadrid.net/auth/signin')
    fillAndSubmit()

    // Registering creates no session, so the next stop is sign-in, which then
    // continues to the pending page.
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://www.josemadrid.net/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fpending',
      ),
    )
  })

  it('stays on the same host when rendered on the main site', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('location', { ...window.location, assign })
    render(<FundraiserAccountForm />)
    fillAndSubmit()

    await waitFor(() => expect(assign).toHaveBeenCalledWith('/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fpending'))
  })

  it('refuses mismatched passwords without calling the server', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<FundraiserAccountForm />)
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Jane Doe' } })
    fireEvent.change(screen.getByLabelText('Organization Name'), { target: { value: 'Band Boosters' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'other-pass' } })
    fireEvent.click(screen.getByRole('button', { name: /create fundraiser account/i }))

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a plain message when the server answers with an error page rather than JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => Promise.reject(new SyntaxError("Unexpected token '<'")) }),
    )
    render(<FundraiserAccountForm />)
    fillAndSubmit()

    expect(await screen.findByText('Unable to create account.')).toBeInTheDocument()
  })
})
