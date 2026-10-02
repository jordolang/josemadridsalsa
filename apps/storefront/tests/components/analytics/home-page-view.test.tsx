import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

const { initAmplitude, track } = vi.hoisted(() => ({ initAmplitude: vi.fn(), track: vi.fn() }))
vi.mock('@/lib/analytics/amplitude', () => ({ initAmplitude, amplitude: { track } }))

import { HomePageView } from '@/components/analytics/home-page-view'

beforeEach(() => {
  initAmplitude.mockReset()
  track.mockReset()
})

describe('HomePageView', () => {
  it('sends Viewed Home Page once Amplitude is initialized', () => {
    initAmplitude.mockReturnValue(true)
    render(<HomePageView />)

    expect(track).toHaveBeenCalledWith('Viewed Home Page', { prompt_version: 'BA400.4' })
  })

  it('sends nothing when Amplitude is disabled', () => {
    initAmplitude.mockReturnValue(false)
    render(<HomePageView />)

    expect(track).not.toHaveBeenCalled()
  })
})
