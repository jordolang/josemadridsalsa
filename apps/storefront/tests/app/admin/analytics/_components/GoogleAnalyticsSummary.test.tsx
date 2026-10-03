import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoogleAnalyticsSummary } from '@/app/admin/analytics/_components/GoogleAnalyticsSummary'

describe('GoogleAnalyticsSummary', () => {
  it('shows why GA data failed to load', () => {
    render(<GoogleAnalyticsSummary summaryCards={[]} isReady={false} message="Google rejected the saved credential." />)
    expect(screen.getByText('Google rejected the saved credential.')).toBeInTheDocument()
  })

  it('keeps the empty-range copy when there is no error', () => {
    render(<GoogleAnalyticsSummary summaryCards={[]} isReady />)
    expect(screen.getByText('No Google Analytics metrics are available for this range yet.')).toBeInTheDocument()
  })
})
