import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CampaignManager } from '@/app/admin/lead-generation/[id]/campaign-manager'
import { LiveLeadFeed } from '@/app/admin/lead-generation/[id]/live-lead-feed'
import type { ScraperEvent } from '@/lib/scraper/event-bus'

const mockRefresh = vi.fn()
const mockPush = vi.fn()
const mockUseScraperStream = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

vi.mock('@/lib/actions/lead-generation', () => ({
  triggerGoogleSearchScraper: vi.fn(),
  triggerWebsiteParser: vi.fn(),
  triggerEmailSender: vi.fn(),
  triggerFullAutomation: vi.fn(),
  deleteLeadCampaign: vi.fn(),
  saveCampaignTemplate: vi.fn(),
}))

vi.mock('@/hooks/use-scraper-stream', () => ({
  useScraperStream: (options: unknown) => mockUseScraperStream(options),
}))

class MockEventSource {
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  close() {}
}

const baseCampaign = {
  id: 'campaign-1',
  name: 'Spring Outreach',
  city: 'Austin',
  state: 'TX',
  district: null,
  schoolType: 'high school',
  leadType: 'SCHOOL_ATHLETICS' as const,
  searchQuery: null,
  businessCategory: null,
  radius: null,
  limit: 25,
  skipNoEmail: true,
  autoSend: false,
  status: 'SCRAPING' as const,
  totalFound: 0,
  totalEmailsFound: 0,
  totalSent: 0,
  totalFailed: 0,
  templateId: null,
  template: null,
  createdAt: new Date('2026-04-19T00:00:00.000Z'),
  updatedAt: new Date('2026-04-19T00:00:00.000Z'),
}

describe('lead generation client behavior', () => {
  beforeEach(() => {
    vi.useRealTimers()
    mockRefresh.mockReset()
    mockPush.mockReset()
    mockUseScraperStream.mockReset()
    mockUseScraperStream.mockReturnValue({ connected: false, events: [], error: null })
    vi.stubGlobal('EventSource', MockEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { leads: [] } }),
      })
    )
  })

  it('does not force a route refresh while scraping is active', () => {
    vi.useFakeTimers()
    render(<CampaignManager campaign={baseCampaign} leads={[]} selectedLeadIds={[]} />)

    act(() => {
      vi.advanceTimersByTime(16000)
    })

    expect(mockRefresh).not.toHaveBeenCalled()
  })

  it('keeps live lead totals deduplicated when the same lead event arrives twice', async () => {
    let onEvent: ((event: ScraperEvent) => void) | undefined
    mockUseScraperStream.mockImplementation((options: { onEvent?: (event: ScraperEvent) => void }) => {
      onEvent = options.onEvent
      return { connected: true, events: [], error: null }
    })

    render(<LiveLeadFeed campaignId="campaign-1" />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const leadFoundEvent: ScraperEvent = {
      type: 'lead:found',
      data: {
        campaignId: 'campaign-1',
        lead: {
          id: 'lead-1',
          schoolName: 'Central High',
          schoolUrl: 'https://central.example.com',
          status: 'SCRAPED',
        },
      },
    }

    act(() => {
      onEvent?.(leadFoundEvent)
      onEvent?.(leadFoundEvent)
    })

    expect(await screen.findByText('Central High')).toBeInTheDocument()
    expect(screen.getByText('Total Leads')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getAllByText('Central High')).toHaveLength(1)
  })
})
