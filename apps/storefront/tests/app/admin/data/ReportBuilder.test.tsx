import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ReportBuilder } from '@/app/admin/data/_components/ReportBuilder'

vi.mock('@/app/admin/data/_components/ReportViewer', () => ({
  ReportViewer: () => <div>report result</div>,
}))

describe('ReportBuilder', () => {
  afterEach(() => vi.restoreAllMocks())

  it('scrolls the result into view after Run report, since it renders below the fold', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: { columns: [], rows: [], totals: {}, meta: {} } }), {
        status: 200,
      })
    )

    render(<ReportBuilder datasetIds={['ledger']} />)
    fireEvent.click(screen.getByRole('button', { name: /run report/i }))

    await screen.findByText('report result')
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled())
  })
})
