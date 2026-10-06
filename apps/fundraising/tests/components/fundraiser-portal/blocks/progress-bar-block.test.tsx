import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProgressBarBlock } from '@/components/fundraiser-portal/blocks/progress-bar-block'
import { validatePageConfig } from '@/lib/fundraiser-page-config'

const fundraiser = { goal: 1000, totalRevenue: 250 }

describe('ProgressBarBlock', () => {
  it('draws a thermometer when the organizer picks that style', () => {
    render(<ProgressBarBlock block={{ type: 'progress_bar', showAmount: true, showPercentage: true, style: 'thermometer' }} fundraiser={fundraiser} />)
    expect(screen.getByRole('img', { name: '25% of $1,000 goal raised' })).toBeInTheDocument()
  })

  it('keeps the horizontal bar by default', () => {
    render(<ProgressBarBlock block={{ type: 'progress_bar', showAmount: true, showPercentage: true }} fundraiser={fundraiser} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('accepts only known styles when the page config is saved', () => {
    const base = { type: 'progress_bar', showAmount: true, showPercentage: true }
    const page = (block: object) => ({ version: 1, theme: 'default', blocks: [block] })
    expect(validatePageConfig(page({ ...base, style: 'thermometer' })).success).toBe(true)
    expect(validatePageConfig(page({ ...base, style: 'pie' })).success).toBe(false)
  })
})
