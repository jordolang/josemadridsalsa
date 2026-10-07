import { afterEach, describe, expect, it, vi } from 'vitest'

async function load(value: string | undefined) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', value as string)
  return import('@/lib/site-url')
}

afterEach(() => vi.unstubAllEnvs())

describe('SITE_URL', () => {
  it('defaults to the current production origin', async () => {
    const { SITE_URL, SITE_DOMAIN } = await load('')
    expect(SITE_URL).toBe('https://www.josemadridsalsa.com')
    expect(SITE_DOMAIN).toBe('josemadridsalsa.com')
  })

  it('follows NEXT_PUBLIC_SITE_URL, so a domain move needs no code change', async () => {
    const { SITE_URL, SITE_DOMAIN } = await load('https://www.josemadridsalsa.com/')
    expect(SITE_URL).toBe('https://www.josemadridsalsa.com')
    expect(SITE_DOMAIN).toBe('josemadridsalsa.com')
  })

  it('drops any path or whitespace pasted into the setting', async () => {
    expect((await load('  https://www.josemadridsalsa.com/shop/  ')).SITE_URL).toBe('https://www.josemadridsalsa.com')
  })

  it('ignores a value that is not a URL', async () => {
    expect((await load('josemadridsalsa')).SITE_URL).toBe('https://www.josemadridsalsa.com')
  })
})
