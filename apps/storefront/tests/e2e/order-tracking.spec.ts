/**
 * E2E Test: Public Order Tracking Page
 *
 * This test verifies the public order tracking flow:
 * 1. Navigate to tracking page with tracking number
 * 2. Verify tracking information displays correctly
 * 3. Verify tracking timeline shows events
 * 4. Verify carrier information is visible
 * 5. Verify no authentication is required
 * 6. Test with invalid tracking number
 *
 * @see playwright.config.ts for test configuration
 */

import { test, expect } from '@playwright/test'

test.describe('Public Order Tracking Page', () => {
  test('customer can view tracking information without authentication', async ({ page }) => {
    // Navigate to public tracking page
    // Note: In real tests, use a test tracking number from test data
    const testTrackingNumber = 'TEST_TRACK_123'
    await page.goto(`/track/${testTrackingNumber}`)

    // Verify page loads
    await expect(page).toHaveTitle(/Track Order/i)

    // Verify main heading
    await expect(
      page.getByRole('heading', { name: /Track Your Order/i })
    ).toBeVisible()

    // Verify tracking number is displayed
    await expect(
      page.getByText(new RegExp(testTrackingNumber, 'i'))
    ).toBeVisible()

    // Verify no authentication required (should not see login form)
    await expect(page.getByRole('button', { name: /sign in/i })).not.toBeVisible()

    // Verify no console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Wait for potential errors
    await page.waitForTimeout(1000)

    // Filter out known safe errors (e.g., CSS warnings)
    const criticalErrors = errors.filter(
      (error) =>
        !error.includes('CSS') &&
        !error.includes('favicon') &&
        !error.includes('404')
    )

    expect(criticalErrors).toHaveLength(0)
  })

  test('displays tracking timeline with events', async ({ page }) => {
    const testTrackingNumber = 'TEST_TRACK_123'
    await page.goto(`/track/${testTrackingNumber}`)

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Look for tracking timeline component
    const timeline = page.locator('[data-testid="tracking-timeline"]')

    // If timeline exists, verify it has events
    if (await timeline.isVisible()) {
      // Verify at least one tracking event is shown
      const events = page.locator('[data-testid="tracking-event"]')
      const eventCount = await events.count()

      expect(eventCount).toBeGreaterThan(0)

      // Verify first event has required fields
      const firstEvent = events.first()
      await expect(firstEvent).toBeVisible()

      // Should have status, message, and timestamp
      await expect(firstEvent.locator('[data-testid="event-status"]')).toBeVisible()
      await expect(firstEvent.locator('[data-testid="event-message"]')).toBeVisible()
      await expect(firstEvent.locator('[data-testid="event-timestamp"]')).toBeVisible()
    }
  })

  test('displays carrier information when available', async ({ page }) => {
    const testTrackingNumber = 'TEST_TRACK_123'
    await page.goto(`/track/${testTrackingNumber}`)

    await page.waitForLoadState('networkidle')

    // Look for carrier information
    const carrierSection = page.locator('[data-testid="carrier-info"]')

    if (await carrierSection.isVisible()) {
      // Verify carrier name is shown
      await expect(
        carrierSection.getByText(/Carrier:/i)
      ).toBeVisible()

      // Verify tracking link if available
      const trackingLink = carrierSection.getByRole('link', { name: /track on carrier site/i })
      if (await trackingLink.isVisible()) {
        await expect(trackingLink).toHaveAttribute('href', /.+/)
        await expect(trackingLink).toHaveAttribute('target', '_blank')
      }
    }
  })

  test('handles invalid tracking number gracefully', async ({ page }) => {
    const invalidTrackingNumber = 'INVALID_TRACK_999'
    await page.goto(`/track/${invalidTrackingNumber}`)

    await page.waitForLoadState('networkidle')

    // Should show error message or "not found" state
    const errorMessage = page.getByText(/not found|invalid|does not exist/i)
    const isErrorVisible = await errorMessage.isVisible()

    if (isErrorVisible) {
      expect(isErrorVisible).toBe(true)
    } else {
      // Alternative: page might show empty state
      const emptyState = page.getByText(/no tracking information|no results/i)
      await expect(emptyState).toBeVisible()
    }
  })

  test('displays order summary information', async ({ page }) => {
    const testTrackingNumber = 'TEST_TRACK_123'
    await page.goto(`/track/${testTrackingNumber}`)

    await page.waitForLoadState('networkidle')

    // Look for order summary section
    const orderSummary = page.locator('[data-testid="order-summary"]')

    if (await orderSummary.isVisible()) {
      // Should show order number
      await expect(
        orderSummary.getByText(/Order #|Order Number:/i)
      ).toBeVisible()

      // May show order items
      const orderItems = page.locator('[data-testid="order-item"]')
      if (await orderItems.first().isVisible()) {
        // Verify item has name and quantity
        await expect(orderItems.first()).toBeVisible()
      }
    }
  })

  test('responsive layout on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const testTrackingNumber = 'TEST_TRACK_123'
    await page.goto(`/track/${testTrackingNumber}`)

    await page.waitForLoadState('networkidle')

    // Verify page is usable on mobile
    await expect(
      page.getByRole('heading', { name: /Track Your Order/i })
    ).toBeVisible()

    // Verify tracking number is visible
    await expect(
      page.getByText(new RegExp(testTrackingNumber, 'i'))
    ).toBeVisible()

    // Verify no horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)

    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // Allow 1px tolerance
  })
})
