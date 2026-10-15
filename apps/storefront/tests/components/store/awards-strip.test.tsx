import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AWARDS, AwardsStrip } from '@/components/store/awards-strip'

describe('AwardsStrip', () => {
  it('lists every confirmed award under one heading, anchored for the Our Awards link', () => {
    render(<AwardsStrip />)

    const section = screen.getByRole('region', { name: 'Recognized nationally' })
    expect(section).toHaveAttribute('id', 'awards')
    const items = within(section).getAllByRole('listitem')
    expect(items).toHaveLength(AWARDS.length)
    for (const award of AWARDS) {
      expect(within(section).getByText(award.title)).toBeInTheDocument()
      expect(within(section).getByText(award.detail)).toBeInTheDocument()
    }
  })
})
