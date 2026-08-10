import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A structural check over every scheduled route.
 *
 * Cron endpoints are ordinary public URLs — nothing about living under `app/api/cron` makes one
 * unreachable. They send customer email, publish to social accounts and write to accounting, so
 * an unguarded one is a stranger's button. Two real faults motivated this: a stub route shipped
 * with no check at all, and several routes carried private copies of the guard that returned
 * `true` whenever `CRON_SECRET` was unset — failing open in exactly the configuration where
 * failing closed matters.
 *
 * Asserted against the source text rather than by invoking the handlers, because the property is
 * "nobody forgot", and a per-route behavioural test only covers routes somebody remembered to
 * write a test for. This one fails the moment a new route appears without the guard.
 */

const CRON_DIR = join(process.cwd(), 'app/api/cron')

function cronRoutes(): Array<{ name: string; source: string }> {
  return readdirSync(CRON_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      source: readFileSync(join(CRON_DIR, entry.name, 'route.ts'), 'utf8'),
    }))
}

describe('cron route guards', () => {
  const routes = cronRoutes()

  it('finds the scheduled routes to check', () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it.each(routes.map((r) => r.name))('%s uses the shared authorization guard', (name) => {
    const route = routes.find((r) => r.name === name)!
    expect(route.source).toContain('isAuthorizedCronRequest')
  })

  it.each(routes.map((r) => r.name))('%s returns 401 when the guard rejects', (name) => {
    const route = routes.find((r) => r.name === name)!
    expect(route.source).toContain('401')
  })

  it.each(routes.map((r) => r.name))('%s does not carry a private fail-open copy', (name) => {
    const route = routes.find((r) => r.name === name)!
    // `if (!secret) return true` is the pattern that leaves a route world-callable whenever the
    // environment variable is missing. The shared guard refuses in production instead.
    expect(route.source).not.toMatch(/if\s*\(!secret\)\s*return true/)
    expect(route.source).not.toMatch(/function isAuthorized\s*\(/)
  })
})
