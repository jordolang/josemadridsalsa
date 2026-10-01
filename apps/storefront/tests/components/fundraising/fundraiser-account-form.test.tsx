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

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.josemadrid.net/fundraiser-portal/pending'))
  })
})
