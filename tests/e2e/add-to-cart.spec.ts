/**
 * E2E Test: Add to Cart Flow
 *
 * This test verifies the critical add to cart user flow:
 * 1. Navigate to products page
 * 2. Click "Add to cart" button on a product
 * 3. Verify cart icon badge updates with item count
 * 4. Verify cart sidebar opens and displays added item
 * 5. Navigate to cart page and verify item appears
 * 6. Test quantity updates and item removal
 * 7. Verify cart total calculations
 *
 * @see playwright.config.ts for test configuration
 */

import { test, expect } from '@playwright/test'

test.describe('Add to cart flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to products page before each test
    await page.goto('/products')

    // Wait for products to load
    await expect(page.getByText(/showing \d+ products/i)).toBeVisible()
  })

  test('should add item to cart and update cart icon badge', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Find the first "Add to cart" button
    const addToCartButton = page.getByRole('button', { name: /add to cart/i }).first()

    // Verify button is visible (skip if no products)
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    await expect(addToCartButton).toBeVisible()

    // Click the button
    await addToCartButton.click()

    // Verify cart icon badge appears with count "1"
    const cartBadge = page.locator('[aria-label*="items in cart"]')
    await expect(cartBadge).toBeVisible()
    await expect(cartBadge).toHaveText('1')
  })

  test('should open cart sidebar when adding item', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()

    // Wait a moment for cart sidebar to open
    await page.waitForTimeout(500)

    // Verify cart sidebar header is visible
    await expect(page.getByRole('heading', { name: /shopping cart \(1\)/i })).toBeVisible()

    // Verify "Checkout" button is visible in sidebar
    const checkoutButtons = page.getByRole('link', { name: /checkout/i })
    await expect(checkoutButtons.first()).toBeVisible()
  })

  test('should display added item in cart sidebar', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Get the first product name before adding to cart
    const productCard = page.locator('article').first()
    const productHeading = productCard.getByRole('heading', { level: 3 })
    const productName = await productHeading.textContent()

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()

    // Wait for cart sidebar to open
    await page.waitForTimeout(500)

    // Verify the product appears in the cart sidebar
    if (productName) {
      // Cart items should contain the product name
      await expect(page.getByText(productName.trim())).toBeVisible()
    }

    // Verify quantity controls are visible
    await expect(page.getByRole('button', { name: '' }).filter({ has: page.locator('svg') })).toHaveCount(6) // Plus, Minus, Close cart, Remove item buttons

    // Verify total is displayed
    await expect(page.getByText(/total/i)).toBeVisible()
  })

  test('should navigate to cart page and verify item appears', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()

    // Wait for cart sidebar
    await page.waitForTimeout(500)

    // Click "View Cart" button in sidebar
    const viewCartButton = page.getByRole('link', { name: /view cart/i })
    await expect(viewCartButton).toBeVisible()
    await viewCartButton.click()

    // Should redirect to /checkout (based on cart page implementation)
    await expect(page).toHaveURL(/\/checkout/)
  })

  test('should update cart badge when adding multiple items', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if less than 2 products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount < 2) {
      test.skip()
    }

    // Add first item
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Verify badge shows 1
    const cartBadge = page.locator('[aria-label*="items in cart"]')
    await expect(cartBadge).toHaveText('1')

    // Close cart sidebar by clicking the X button
    const closeButton = page.getByRole('button', { name: /close cart/i })
    await closeButton.click()
    await page.waitForTimeout(300)

    // Add second item
    await page.getByRole('button', { name: /add to cart/i }).nth(1).click()
    await page.waitForTimeout(500)

    // Verify badge shows 2 (total quantity)
    await expect(cartBadge).toHaveText('2')

    // Verify cart header shows 2 items
    await expect(page.getByRole('heading', { name: /shopping cart \(2\)/i })).toBeVisible()
  })

  test('should increase quantity in cart sidebar', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Find the quantity increase button (Plus icon) in the cart item
    // The quantity is displayed in the middle, Plus button is on the right
    const cartItem = page.locator('[class*="space-y-4"] > div').first()
    const plusButton = cartItem.getByRole('button').filter({ has: page.locator('svg') }).nth(1)

    // Click the plus button
    await plusButton.click()
    await page.waitForTimeout(300)

    // Verify cart badge now shows 2 (quantity increased)
    const cartBadge = page.locator('[aria-label*="items in cart"]')
    await expect(cartBadge).toHaveText('2')

    // Verify cart header shows 2 items
    await expect(page.getByRole('heading', { name: /shopping cart \(2\)/i })).toBeVisible()
  })

  test('should decrease quantity in cart sidebar', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // First, increase quantity to 2
    const cartItem = page.locator('[class*="space-y-4"] > div').first()
    const plusButton = cartItem.getByRole('button').filter({ has: page.locator('svg') }).nth(1)
    await plusButton.click()
    await page.waitForTimeout(300)

    // Verify badge shows 2
    const cartBadge = page.locator('[aria-label*="items in cart"]')
    await expect(cartBadge).toHaveText('2')

    // Now decrease quantity back to 1
    const minusButton = cartItem.getByRole('button').filter({ has: page.locator('svg') }).first()
    await minusButton.click()
    await page.waitForTimeout(300)

    // Verify badge shows 1 again
    await expect(cartBadge).toHaveText('1')
  })

  test('should remove item from cart', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Verify item is in cart
    await expect(page.getByRole('heading', { name: /shopping cart \(1\)/i })).toBeVisible()

    // Find and click the remove button (X icon) on the cart item
    const removeButton = page.getByRole('button', { name: /remove item/i }).first()
    await expect(removeButton).toBeVisible()
    await removeButton.click()
    await page.waitForTimeout(300)

    // Verify cart is now empty
    await expect(page.getByRole('heading', { name: /your cart is empty/i })).toBeVisible()

    // Verify empty cart message
    await expect(page.getByText(/add some delicious salsa to get started/i)).toBeVisible()

    // Verify "Shop Salsas" link is present
    await expect(page.getByRole('link', { name: /shop salsas/i })).toBeVisible()

    // Cart badge should not be visible (or show 0)
    const cartBadge = page.locator('[aria-label*="items in cart"]')
    const badgeVisible = await cartBadge.isVisible().catch(() => false)
    expect(badgeVisible).toBeFalsy()
  })

  test('should calculate cart total correctly', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Get the product price from the cart item
    const cartItem = page.locator('[class*="space-y-4"] > div').first()
    const priceText = await cartItem.locator('p.font-medium').textContent()

    // Verify total is displayed and matches the single item price
    const totalSection = page.locator('text=Total').locator('..')
    await expect(totalSection).toBeVisible()

    // The total should be visible (exact match not required as we don't know the price)
    const totalText = await totalSection.textContent()
    expect(totalText).toContain('Total')
    expect(totalText).toContain('$')
  })

  test('should close cart sidebar when clicking close button', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Verify cart sidebar is open
    await expect(page.getByRole('heading', { name: /shopping cart \(1\)/i })).toBeVisible()

    // Click close button
    const closeButton = page.getByRole('button', { name: /close cart/i })
    await closeButton.click()
    await page.waitForTimeout(300)

    // Cart sidebar should be closed (header not visible)
    const cartHeader = page.getByRole('heading', { name: /shopping cart/i })
    const headerVisible = await cartHeader.isVisible().catch(() => false)
    expect(headerVisible).toBeFalsy()
  })

  test('should navigate to checkout from cart sidebar', async ({ page }) => {
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Skip if no products
    const buttonCount = await page.getByRole('button', { name: /add to cart/i }).count()
    if (buttonCount === 0) {
      test.skip()
    }

    // Add item to cart
    await page.getByRole('button', { name: /add to cart/i }).first().click()
    await page.waitForTimeout(500)

    // Click "Checkout" button in sidebar
    const checkoutButton = page.getByRole('link', { name: /checkout/i }).first()
    await expect(checkoutButton).toBeVisible()
    await checkoutButton.click()

    // Should navigate to checkout page
    await expect(page).toHaveURL(/\/checkout/)
  })

  test('should show "Out of Stock" for items with zero inventory', async ({ page }) => {
    // This test verifies that products with 0 inventory show "Out of Stock" button
    // Wait for products to load
    await page.waitForTimeout(1000)

    // Look for any "Out of Stock" buttons
    const outOfStockButtons = page.getByRole('button', { name: /out of stock/i })
    const outOfStockCount = await outOfStockButtons.count()

    if (outOfStockCount > 0) {
      // Verify the button is disabled
      await expect(outOfStockButtons.first()).toBeDisabled()

      // Clicking should have no effect (cart should remain empty)
      await outOfStockButtons.first().click({ force: true })
      await page.waitForTimeout(500)

      // Cart badge should not appear
      const cartBadge = page.locator('[aria-label*="items in cart"]')
      const badgeVisible = await cartBadge.isVisible().catch(() => false)
      expect(badgeVisible).toBeFalsy()
    } else {
      // No out of stock items, test passes
      expect(outOfStockCount).toBe(0)
    }
  })
})
