/**
 * E2E: Fundraiser Battle Arena
 *
 * Exercises what can be verified without seeded period data:
 *   - invalid period format → 404
 *   - valid but empty period → renders header + empty-state message
 *   - LIVE badge mounts (polling starts)
 *
 * Full gameplay coverage (share throttling + purchase damage + HP bar
 * regression) requires seeded FundraiserTeam + FundraiserShield rows and
 * is deferred until the seed script lands.
 */

import { test, expect } from '@playwright/test'

test.describe('Fundraiser Battle Arena', () => {
  test('invalid period returns 404', async ({ page }) => {
    const res = await page.goto('/arena/not-a-period')
    expect(res?.status()).toBe(404)
  })

  test('valid empty period renders header + empty state', async ({ page }) => {
    // A period far enough in the future that no team will be active.
    await page.goto('/arena/2099-12')
    await expect(
      page.getByRole('heading', { name: '2099-12' }),
    ).toBeVisible()
    await expect(
      page.getByText(/no active teams for 2099-12/i),
    ).toBeVisible()
  })

  test('live badge mounts on arena page', async ({ page }) => {
    await page.goto('/arena/2099-12')
    // Badge shows SYNC while polling kicks off, then LIVE once a fetch lands.
    await expect(page.getByText(/^(SYNC|LIVE|RETRY)$/)).toBeVisible({
      timeout: 10_000,
    })
  })
})
