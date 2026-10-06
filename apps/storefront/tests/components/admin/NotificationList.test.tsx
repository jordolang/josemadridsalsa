import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { NotificationList, type NotificationRow } from '@/components/admin/NotificationList'

const base: NotificationRow = {
  id: 'n1',
  type: 'CUSTOMER_EMAIL',
  severity: 'WARNING',
  title: 'General Question from Fuel Rewards',
  message: 'From Fuel Rewards <rewards@mail.fuelrewards.com>\nSubject: Earn an extra 20¢/gal',
  link: '/admin/inbox/e1',
  isRead: false,
  createdAt: '2026-10-05T22:10:00.000Z',
}

const email = {
  heading: 'General Question from Fuel Rewards',
  from: 'Fuel Rewards <rewards@mail.fuelrewards.com>',
  subject: 'Earn an extra 20¢/gal',
  summary: null,
  steps: [
    { instruction: 'Open the email in Gmail and read it in full.', isOptional: false, done: false },
    { instruction: 'Reply to the customer.', isOptional: false, done: false },
  ],
  gmailUrl: 'https://mail.google.com/mail/u/0/#all/1a10e197e5c845bc',
  classification: 'Anthropic Classification Not Available',
}

describe('NotificationList', () => {
  it('lays a customer-email alert out in sections', () => {
    render(<NotificationList notifications={[{ ...base, email }]} />)

    expect(screen.getByRole('link', { name: 'General Question from Fuel Rewards' })).toHaveAttribute(
      'href',
      '/admin/inbox/e1',
    )
    expect(screen.getByText('Email information')).toBeInTheDocument()
    expect(screen.getByText('From: Fuel Rewards <rewards@mail.fuelrewards.com>')).toBeInTheDocument()
    expect(screen.getByText('Subject: Earn an extra 20¢/gal')).toBeInTheDocument()
    expect(screen.getByText('To clear, the following must be performed:')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Step 1 — Open the email in Gmail and read it in full.',
      'Step 2 — Reply to the customer.',
    ])
    expect(screen.getByRole('link', { name: email.gmailUrl })).toHaveAttribute('href', email.gmailUrl)
    expect(screen.getByText(/New Alert · Anthropic Classification Not Available/)).toBeInTheDocument()
  })

  it('keeps line breaks in other notifications', () => {
    render(<NotificationList notifications={[{ ...base, type: 'SYSTEM', email: null }]} />)
    expect(screen.getByText(/From Fuel Rewards/)).toHaveClass('whitespace-pre-line')
  })
})
