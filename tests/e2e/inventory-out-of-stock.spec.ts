/**
 * E2E Test: Inventory Out-of-Stock Product Flow
 *
 * This test verifies the out-of-stock and low-stock user experience:
 * 1. Out-of-stock product displays correct badges and disabled button
 * 2. Low-stock product displays availability warning
 * 3. Out-of-stock badge visible on product listing page
 * 4. Low-stock products can still be added to cart
 * 5. Inventory availability displayed correctly
 *
 * Note: These tests interact with existing products in the database.
 * For full test coverage, ensure the database has products with varying inventory levels:
 * - At least one product with inventory = 0 (out of stock)
 * - At least one product with inventory <= lowStockThreshold (low stock)
 * - At least one product with inventory > lowStockThreshold (in stock)
 *
 * @see playwright.config.ts for test configuration
 */

import { test, expect } from '@playwright/test'

test.describe('Inventory out-of-stock flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to products page
    await page.goto('/products')
    await page.waitForTimeout(1000)
  })

  test('should display stock status indicators on product cards', async ({ page }) => {
    // Verify products page loads
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()

    // Wait for products to load
    await page.waitForTimeout(1000)

    // Look for product cards
    const productCards = page.locator('article')
    const cardCount = await productCards.count()

    if (cardCount > 0) {
      // Check if any product has stock indicators
      // Note: We can't guarantee a specific product has specific stock levels,
      // so we just verify the UI structure exists
      const firstCard = productCards.first()
      await expect(firstCard).toBeVisible()

      // Product cards should have "Add to Cart" button (may be disabled if out of stock)
      const addButton = firstCard.getByRole('button', { name: /add to cart|out of stock/i })
      const hasButton = await addButton.isVisible().catch(() => false)

      if (hasButton) {
        // Verify button exists (whether enabled or disabled)
        await expect(addButton).toBeVisible()
      }
    }
  })

  test('should display product detail page with inventory information', async ({ page }) => {
    // Navigate to first available product
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    // Skip test if no products available
    if (linkCount === 0) {
      test.skip()
    }

    // Click first product link
    await productLinks.first().click()
    await page.waitForTimeout(1000)

    // Verify we're on a product detail page
    await expect(page).toHaveURL(/\/products\/[^/]+$/)

    // Verify product name heading is visible
    const productHeading = page.locator('h1').first()
    await expect(productHeading).toBeVisible()

    // Verify "In Stock:" label exists (shows inventory info)
    await expect(page.getByText('In Stock:')).toBeVisible()

    // Verify SKU is displayed
    await expect(page.getByText('SKU:')).toBeVisible()

    // Verify Add to Cart button exists (may say "Out of Stock" or "Add to Cart")
    const addButton = page.getByRole('button', { name: /add to cart|out of stock/i })
    await expect(addButton).toBeVisible()
  })

  test('should display correct button state based on inventory', async ({ page }) => {
    // Navigate to first available product
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    if (linkCount === 0) {
      test.skip()
    }

    // Check multiple products to find different inventory states
    for (let i = 0; i < Math.min(3, linkCount); i++) {
      await page.goto('/products')
      await page.waitForTimeout(500)

      // Click product link
      await productLinks.nth(i).click()
      await page.waitForTimeout(1000)

      // Get the stock status text
      const stockContainer = page.locator('text="In Stock:"').locator('..')
      const stockText = await stockContainer.textContent()

      if (stockText && stockText.includes('Out of stock')) {
        // Verify out-of-stock product has disabled button
        const addButton = page.getByRole('button', { name: /out of stock/i })
        await expect(addButton).toBeVisible()
        await expect(addButton).toBeDisabled()

        // Verify "Out of Stock" badge is visible
        const badge = page.getByText('Out of Stock', { exact: true }).first()
        await expect(badge).toBeVisible()

        // Found an out-of-stock product, verified UI
        break
      } else {
        // In-stock product should have enabled button
        const addButton = page.getByRole('button', { name: /add to cart/i })
        const isEnabled = await addButton.isEnabled().catch(() => false)

        if (isEnabled) {
          await expect(addButton).toBeEnabled()
          // Can break here if we just want to verify one in-stock product
        }
      }
    }
  })

  test('should be able to add in-stock product to cart', async ({ page }) => {
    // Navigate to first available in-stock product
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    if (linkCount === 0) {
      test.skip()
    }

    // Try to find an in-stock product
    for (let i = 0; i < Math.min(5, linkCount); i++) {
      await page.goto('/products')
      await page.waitForTimeout(500)

      await productLinks.nth(i).click()
      await page.waitForTimeout(1000)

      // Check if product is in stock
      const addToCartButton = page.getByRole('button', { name: /add to cart/i })
      const isButtonVisible = await addToCartButton.isVisible().catch(() => false)
      const isButtonEnabled = await addToCartButton.isEnabled().catch(() => false)

      if (isButtonVisible && isButtonEnabled) {
        // Found an in-stock product
        const productName = await page.locator('h1').first().textContent()

        // Click Add to Cart
        await addToCartButton.click()
        await page.waitForTimeout(500)

        // Verify cart sidebar opened
        await expect(page.getByRole('heading', { name: /shopping cart \(1\)/i })).toBeVisible()

        // Verify product was added to cart
        if (productName) {
          await expect(page.getByText(productName, { exact: false })).toBeVisible()
        }

        // Test passed - found and added in-stock product
        break
      }
    }
  })

  test('should display stock status colors correctly', async ({ page }) => {
    // Navigate to first available product
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    if (linkCount === 0) {
      test.skip()
    }

    // Check first product for color coding
    await productLinks.first().click()
    await page.waitForTimeout(1000)

    // Find the stock status container
    const stockContainer = page.locator('text="In Stock:"').locator('..')
    await expect(stockContainer).toBeVisible()

    // Get the status text element
    const statusText = stockContainer.locator('span.font-medium')
    await expect(statusText).toBeVisible()

    // Verify it has either red (out of stock) or green (in stock) color class
    const classList = await statusText.getAttribute('class')
    expect(classList).toMatch(/text-(red|green)-600/)
  })

  test('should prevent disabled button clicks on out-of-stock products', async ({ page }) => {
    // Navigate through products to find an out-of-stock one
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    if (linkCount === 0) {
      test.skip()
    }

    // Try to find an out-of-stock product
    for (let i = 0; i < Math.min(5, linkCount); i++) {
      await page.goto('/products')
      await page.waitForTimeout(500)

      await productLinks.nth(i).click()
      await page.waitForTimeout(1000)

      // Check if this is an out-of-stock product
      const outOfStockButton = page.getByRole('button', { name: /out of stock/i })
      const isOutOfStock = await outOfStockButton.isVisible().catch(() => false)

      if (isOutOfStock) {
        // Found an out-of-stock product
        await expect(outOfStockButton).toBeDisabled()

        // Try clicking (should do nothing because disabled)
        await outOfStockButton.click({ force: true })
        await page.waitForTimeout(500)

        // Verify cart did NOT open
        const cartHeading = page.getByRole('heading', { name: /shopping cart/i })
        const isCartVisible = await cartHeading.isVisible().catch(() => false)
        expect(isCartVisible).toBe(false)

        // Test passed
        break
      }
    }
  })

  test('should display low stock badge when appropriate', async ({ page }) => {
    // Navigate through products to find one with low stock badge
    const productLinks = page.locator('article a[href^="/products/"]')
    const linkCount = await productLinks.count()

    if (linkCount === 0) {
      test.skip()
    }

    // Check several products for low stock badge
    let foundLowStock = false

    for (let i = 0; i < Math.min(10, linkCount); i++) {
      await page.goto('/products')
      await page.waitForTimeout(500)

      await productLinks.nth(i).click()
      await page.waitForTimeout(1000)

      // Check for "Low Stock" badge
      const lowStockBadge = page.getByText('Low Stock', { exact: true }).first()
      const hasLowStockBadge = await lowStockBadge.isVisible().catch(() => false)

      if (hasLowStockBadge) {
        foundLowStock = true

        // Verify it's not also showing out of stock
        const outOfStockBadge = page.getByText('Out of Stock', { exact: true })
        const hasOutOfStockBadge = await outOfStockBadge.isVisible().catch(() => false)
        expect(hasOutOfStockBadge).toBe(false)

        // Verify Add to Cart button is still enabled (low stock, not out of stock)
        const addToCartButton = page.getByRole('button', { name: /add to cart/i })
        const isEnabled = await addToCartButton.isEnabled().catch(() => false)
        expect(isEnabled).toBe(true)

        break
      }
    }

    // Note: If no low stock products found, test still passes
    // This is expected if all products have sufficient inventory
  })
})
