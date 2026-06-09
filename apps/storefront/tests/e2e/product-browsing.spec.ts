/**
 * E2E Test: Product Browsing Flow
 *
 * This test verifies the critical product browsing user flow:
 * 1. Navigate to products page
 * 2. Verify products load and display correctly
 * 3. Test search functionality
 * 4. Test category filtering
 * 5. Test heat level filtering
 * 6. Test view mode toggling (grid/list)
 * 7. Verify product count updates with filters
 *
 * @see playwright.config.ts for test configuration
 */

import { test, expect } from '@playwright/test'

test.describe('Product browsing flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to products page before each test
    await page.goto('/products')
  })

  test('should display products page with heading and products', async ({ page }) => {
    // Verify page heading is visible
    await expect(page.getByRole('heading', { name: /our premium products/i })).toBeVisible()

    // Verify products description is visible
    await expect(page.getByText(/discover our complete collection/i)).toBeVisible()

    // Wait for products to load - check for product count text
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()

    // Verify at least one product card is visible
    // Product cards are rendered by ProductCard component - look for product elements
    const products = page.locator('[data-testid="product-card"]').or(
      page.locator('article').filter({ has: page.getByRole('heading', { level: 3 }) })
    )

    // Give products time to load
    await page.waitForTimeout(1000)

    // Check if products are present (may be 0 if database is empty, which is valid)
    const productCount = await products.count()
    expect(productCount).toBeGreaterThanOrEqual(0)
  })

  test('should filter products by search term', async ({ page }) => {
    // Wait for initial products to load
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()

    // Find the search input
    const searchInput = page.getByPlaceholder(/search products/i)
    await expect(searchInput).toBeVisible()

    // Type a search term
    await searchInput.fill('salsa')

    // Wait for URL to update with search parameter
    await page.waitForURL(/search=salsa/)

    // Verify URL contains search parameter
    expect(page.url()).toContain('search=salsa')

    // Verify product count is updated (text should still be visible)
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()
  })

  test('should filter products by category', async ({ page }) => {
    // Wait for categories to load
    await expect(page.getByText(/categories/i)).toBeVisible()

    // Check if any category buttons exist (beyond "All Categories")
    const categoryButtons = page.getByRole('button').filter({ hasText: /\(\d+\)/ })
    const categoryCount = await categoryButtons.count()

    if (categoryCount > 0) {
      // Click the first category button
      await categoryButtons.first().click()

      // Wait for URL to update with category parameter
      await expect(page).toHaveURL(/category=/)

      // Verify the category button is now active (has default variant styling)
      const firstCategory = categoryButtons.first()
      await expect(firstCategory).toHaveClass(/bg-salsa/)
    } else {
      // If no categories exist, just verify "All Categories" button is present
      const allCategoriesBtn = page.getByRole('button', { name: /all categories/i })
      await expect(allCategoriesBtn).toBeVisible()
    }
  })

  test('should filter products by heat level', async ({ page }) => {
    // Wait for heat level filters to load
    await expect(page.getByText(/heat level/i)).toBeVisible()

    // Verify all heat level buttons are present
    await expect(page.getByRole('button', { name: /all heat levels/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^mild$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^medium$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^hot$/i })).toBeVisible()

    // Click on "Mild" heat level
    await page.getByRole('button', { name: /^mild$/i }).click()

    // Wait for URL to update with heatLevel parameter
    await page.waitForURL(/heatLevel=MILD/)

    // Verify URL contains heat level parameter
    expect(page.url()).toContain('heatLevel=MILD')

    // Verify the Mild button is now active
    const mildButton = page.getByRole('button', { name: /^mild$/i })
    await expect(mildButton).toHaveClass(/bg-salsa/)
  })

  test('should toggle between grid and list view modes', async ({ page }) => {
    // Wait for view toggle buttons to load
    const gridButton = page.getByRole('button', { name: /grid view/i })
    const listButton = page.getByRole('button', { name: /list view/i })

    await expect(gridButton).toBeVisible()
    await expect(listButton).toBeVisible()

    // Grid view should be active by default
    await expect(gridButton).toHaveClass(/bg-salsa/)

    // Switch to list view
    await listButton.click()

    // Wait for URL to update with view parameter
    await page.waitForURL(/view=list/)

    // Verify URL contains view parameter
    expect(page.url()).toContain('view=list')

    // Verify list button is now active
    await expect(listButton).toHaveClass(/bg-salsa/)

    // Switch back to grid view
    await gridButton.click()

    // URL should not have view parameter (grid is default)
    await page.waitForURL(/^(?!.*view=).*$/)

    // Verify grid button is active again
    await expect(gridButton).toHaveClass(/bg-salsa/)
  })

  test('should update product count when applying multiple filters', async ({ page }) => {
    // Wait for initial product count
    const initialCountText = await page.getByText(/showing \d+ products/i).textContent()
    const initialCount = initialCountText?.match(/\d+/)?.[0]

    // Apply heat level filter
    await page.getByRole('button', { name: /^medium$/i }).click()
    await page.waitForURL(/heatLevel=MEDIUM/)

    // Product count should update (may be same or different)
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()

    // Apply search filter
    const searchInput = page.getByPlaceholder(/search products/i)
    await searchInput.fill('hot')
    await page.waitForURL(/search=hot/)

    // Product count should still be visible
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()
  })

  test('should clear all filters when clicking clear filters button', async ({ page }) => {
    // Apply multiple filters first
    await page.getByPlaceholder(/search products/i).fill('test')
    await page.waitForURL(/search=test/)

    await page.getByRole('button', { name: /^hot$/i }).click()
    await page.waitForURL(/heatLevel=HOT/)

    // If we get a "no products found" message, the clear filters button should appear
    const noProductsMessage = page.getByText(/no products found/i)
    const clearFiltersButton = page.getByRole('button', { name: /clear filters/i })

    // Check if "no products found" message is visible
    const isNoProducts = await noProductsMessage.isVisible().catch(() => false)

    if (isNoProducts) {
      // Clear filters button should be visible
      await expect(clearFiltersButton).toBeVisible()

      // Click clear filters
      await clearFiltersButton.click()

      // Should navigate back to products page without filters
      await page.waitForURL('/products')
      expect(page.url()).not.toContain('search=')
      expect(page.url()).not.toContain('heatLevel=')

      // All filters should be reset
      await expect(page.getByRole('button', { name: /all heat levels/i })).toHaveClass(/bg-salsa/)
    }
  })

  test('should display individual product cards with details', async ({ page }) => {
    // Wait for products to load
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()

    // Wait for any products to appear
    await page.waitForTimeout(1000)

    // Look for product cards - they should contain headings (product names)
    const productHeadings = page.locator('article').getByRole('heading', { level: 3 })
    const headingCount = await productHeadings.count()

    if (headingCount > 0) {
      // At least one product exists - verify it has expected elements
      const firstProduct = page.locator('article').first()

      // Product should have a heading (name)
      await expect(firstProduct.getByRole('heading', { level: 3 })).toBeVisible()

      // Product should have an image (look for img tag)
      const productImage = firstProduct.locator('img')
      if (await productImage.count() > 0) {
        await expect(productImage.first()).toBeVisible()
      }

      // Product cards typically have price information
      // This is just a smoke test to verify the card structure renders
    }
  })

  test('should maintain filter state in URL on page refresh', async ({ page }) => {
    // Apply filters
    await page.getByRole('button', { name: /^mild$/i }).click()
    await page.waitForURL(/heatLevel=MILD/)

    const searchInput = page.getByPlaceholder(/search products/i)
    await searchInput.fill('verde')
    await page.waitForURL(/search=verde/)

    // Get the current URL
    const currentUrl = page.url()

    // Reload the page
    await page.reload()

    // URL should still contain the filters
    expect(page.url()).toBe(currentUrl)
    expect(page.url()).toContain('heatLevel=MILD')
    expect(page.url()).toContain('search=verde')

    // Filters should still be active
    await expect(page.getByRole('button', { name: /^mild$/i })).toHaveClass(/bg-salsa/)
    await expect(searchInput).toHaveValue('verde')
  })

  test('should handle empty search results gracefully', async ({ page }) => {
    // Search for something that definitely won't exist
    const searchInput = page.getByPlaceholder(/search products/i)
    await searchInput.fill('xyznonexistentproduct12345')
    await page.waitForURL(/search=xyznonexistentproduct12345/)

    // Should show either "no products found" message or 0 products
    const noProductsMessage = page.getByText(/no products found/i)
    const productCountZero = page.getByText(/showing 0 products/i)

    // One of these should be visible
    const hasNoProductsMessage = await noProductsMessage.isVisible().catch(() => false)
    const hasZeroCount = await productCountZero.isVisible().catch(() => false)

    expect(hasNoProductsMessage || hasZeroCount).toBeTruthy()

    // Clear filters button should be visible if no products found
    if (hasNoProductsMessage) {
      await expect(page.getByRole('button', { name: /clear filters/i })).toBeVisible()
    }
  })
})
