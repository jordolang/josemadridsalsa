// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { HomeHeroVideo } from '@/components/store/home-hero-video'

const SRC = '/images/home/redesign/hero-loop.mp4'

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })))
}

function mockReadyState(state: DocumentReadyState) {
  vi.spyOn(document, 'readyState', 'get').mockReturnValue(state)
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('HomeHeroVideo', () => {
  it('waits for the page to load before fetching the video', () => {
    mockReducedMotion(false)
    mockReadyState('interactive')
    const { container } = render(<HomeHeroVideo src={SRC} />)
    const video = container.querySelector('video')!

    expect(video.getAttribute('src')).toBeNull()
    window.dispatchEvent(new Event('load'))
    expect(video.getAttribute('src')).toBe(SRC)
  })

  it('starts right away when the page has already loaded', () => {
    mockReducedMotion(false)
    mockReadyState('complete')
    const { container } = render(<HomeHeroVideo src={SRC} />)

    expect(container.querySelector('video')!.getAttribute('src')).toBe(SRC)
  })

  it('never fetches the video for visitors who prefer reduced motion', () => {
    mockReducedMotion(true)
    mockReadyState('complete')
    const { container } = render(<HomeHeroVideo src={SRC} />)

    expect(container.querySelector('video')!.getAttribute('src')).toBeNull()
  })
})
