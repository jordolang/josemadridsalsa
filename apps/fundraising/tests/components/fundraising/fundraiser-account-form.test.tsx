import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FundraiserAccountForm } from '@/components/fundraising/fundraiser-account-form'

const assign = vi.fn()

afterEach(() => {
  vi.unstubAllGlobals()
  assign.mockReset()
})

function fillAndSubmit({ pickPackage = true, pickColors = true } = {}) {
  fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'Jane Doe' } })
  fireEvent.change(screen.getByLabelText('Organization Name'), { target: { value: 'Band Boosters' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jane@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret-pass' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'secret-pass' } })
  if (pickPackage) fireEvent.click(screen.getByRole('radio', { name: /^16 flavors/ }))
  if (pickColors) {
    fireEvent.change(screen.getByLabelText('Main color'), { target: { value: '#c8102e' } })
    fireEvent.change(screen.getByLabelText('Secondary color'), { target: { value: '#ffffff' } })
    fireEvent.change(screen.getByLabelText('Accent color'), { target: { value: '#000000' } })
  }
  fireEvent.click(screen.getByRole('button', { name: /create fundraiser account/i }))
}

describe('FundraiserAccountForm', () => {
  it('sends the new account to the portal on the main site when rendered on another host', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    vi.stubGlobal('location', { ...window.location, assign })
    render(<FundraiserAccountForm siteUrl="https://www.josemadridsalsa.com" />)

    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', 'https://www.josemadridsalsa.com/auth/signin')
    fillAndSubmit()

    // Registering creates no session, so the next stop is sign-in, which then
    // continues to the pending page.
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith(
        'https://www.josemadridsalsa.com/auth/signin?callbackUrl=%2Ffundraiser-portal%2Fpending',
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

  it('refuses to submit until a salsa package is chosen', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<FundraiserAccountForm />)
    fillAndSubmit({ pickPackage: false })

    expect(screen.getByText('Please choose a 9, 16 or 25 flavor package.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses to submit until all three colors are chosen', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<FundraiserAccountForm />)
    fillAndSubmit({ pickColors: false })

    expect(screen.getByText('Please choose your main, secondary and accent colors.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends the three colors with the sign-up', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('location', { ...window.location, assign })
    render(<FundraiserAccountForm />)
    fillAndSubmit()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      brandColor: '#c8102e',
      secondaryColor: '#ffffff',
      accentColor: '#000000',
    })
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
