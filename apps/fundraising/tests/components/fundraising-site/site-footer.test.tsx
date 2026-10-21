import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FundraisingSiteFooter } from '@/components/fundraising-site/site-footer'

describe('FundraisingSiteFooter', () => {
  it('leads with the Start a Fundraiser call to action', () => {
    render(<FundraisingSiteFooter />)
    expect(screen.getByText('Big flavor. Bigger impact.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start a Fundraiser' })).toHaveAttribute('href', '/start')
  })

  it('keeps the fundraiser resource links (sign-up, final order) reachable', () => {
    render(<FundraisingSiteFooter />)
    expect(screen.getByRole('link', { name: 'Fundraiser Sign-Up' })).toHaveAttribute('href', '/sign-up')
    expect(screen.getByRole('link', { name: 'Submit Final Order' })).toHaveAttribute('href', '/submit')
  })

  it('links privacy and terms to the retail site, where those pages live', () => {
    render(<FundraisingSiteFooter />)
    expect(screen.getByRole('link', { name: 'Privacy Policy' }).getAttribute('href')).toMatch(/\/privacy$/)
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toMatch(/\/terms$/)
  })
})
