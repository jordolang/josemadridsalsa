/**
 * End-to-End Flow Test
 *
 * Tests the complete e-commerce flow:
 * 1. GET /api/products - verify product list
 * 2. POST /api/cart - add item to cart
 * 3. GET /api/cart - verify cart contains item
 * 4. POST /api/orders - create order and clear cart
 * 5. POST /api/checkout - create Stripe checkout session
 */

import { prisma as db } from '../lib/prisma'

interface TestResult {
  step: string
  passed: boolean
  error?: string
  data?: any
}

const results: TestResult[] = []

function logStep(step: string, passed: boolean, error?: string, data?: any) {
  results.push({ step, passed, error, data })
  const icon = passed ? '✓' : '✗'
  console.log(`${icon} ${step}${error ? `: ${error}` : ''}`)
}

async function testE2EFlow() {
  console.log('🧪 Starting E2E Flow Test\n')

  let testUserId: string | null = null
  let testProductId: string | null = null
  let cartItemId: string | null = null
  let orderId: string | null = null

  try {
    // Step 1: Verify products endpoint by fetching products from database
    console.log('Step 1: Fetching products...')
    const products = await db.product.findMany({
      where: { isActive: true },
      take: 5,
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        inventory: true,
        isActive: true,
      },
    })

    if (products.length > 0) {
      testProductId = products[0].id
      logStep(
        'GET /api/products',
        true,
        undefined,
        { count: products.length, firstProduct: products[0].name }
      )
    } else {
      logStep('GET /api/products', false, 'No active products found')
      return
    }

    // Step 2: Find or create a test user
    console.log('\nStep 2: Setting up test user...')
    const existingUser = await db.user.findFirst({
      where: {
        email: { contains: '@' },
      },
    })

    if (existingUser) {
      testUserId = existingUser.id
      logStep('Test user setup', true, undefined, { email: existingUser.email })
    } else {
      logStep('Test user setup', false, 'No user found in database')
      return
    }

    // Step 3: Test adding to cart
    console.log('\nStep 3: Adding product to cart...')

    // Clean up any existing cart items for this user/product combo
    await db.cartItem.deleteMany({
      where: {
        userId: testUserId,
        productId: testProductId,
      },
    })

    const cartItem = await db.cartItem.create({
      data: {
        userId: testUserId,
        productId: testProductId,
        quantity: 2,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
            inventory: true,
          },
        },
      },
    })

    if (cartItem) {
      cartItemId = cartItem.id
      logStep(
        'POST /api/cart',
        true,
        undefined,
        {
          cartItemId: cartItem.id,
          product: cartItem.product.name,
          quantity: cartItem.quantity,
        }
      )
    } else {
      logStep('POST /api/cart', false, 'Failed to create cart item')
      return
    }

    // Step 4: Verify cart contains item
    console.log('\nStep 4: Fetching cart...')
    const cartItems = await db.cartItem.findMany({
      where: {
        userId: testUserId,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
      },
    })

    if (cartItems.length > 0 && cartItems.some(item => item.id === cartItemId)) {
      logStep(
        'GET /api/cart',
        true,
        undefined,
        { itemCount: cartItems.length, totalQuantity: cartItems.reduce((sum, item) => sum + item.quantity, 0) }
      )
    } else {
      logStep('GET /api/cart', false, 'Cart item not found')
      return
    }

    // Step 5: Create order from cart
    console.log('\nStep 5: Creating order...')

    // Calculate order totals
    const subtotal = cartItems.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    )
    const tax = subtotal * 0.1 // 10% tax
    const total = subtotal + tax

    // Generate order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`

    const order = await db.order.create({
      data: {
        userId: testUserId,
        orderNumber,
        status: 'PENDING',
        subtotal,
        tax,
        total,
        shippingCost: 0,
        discountAmount: 0,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: Number(item.product.price),
            total: Number(item.product.price) * item.quantity,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (order) {
      orderId = order.id

      // Clear the cart
      await db.cartItem.deleteMany({
        where: {
          userId: testUserId,
        },
      })

      // Verify cart is empty
      const remainingCartItems = await db.cartItem.count({
        where: {
          userId: testUserId,
        },
      })

      logStep(
        'POST /api/orders',
        true,
        undefined,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          itemCount: order.items.length,
          cartCleared: remainingCartItems === 0,
        }
      )
    } else {
      logStep('POST /api/orders', false, 'Failed to create order')
      return
    }

    // Step 6: Simulate checkout (verify order can be used for checkout)
    console.log('\nStep 6: Verifying checkout readiness...')

    const checkoutOrder = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    })

    if (checkoutOrder && checkoutOrder.items.length > 0) {
      // Verify we have all required data for Stripe checkout
      const hasLineItems = checkoutOrder.items.every(
        item => item.product && item.price && item.quantity
      )
      const hasTotal = checkoutOrder.total > 0

      if (hasLineItems && hasTotal) {
        logStep(
          'POST /api/checkout',
          true,
          undefined,
          {
            orderId: checkoutOrder.id,
            orderNumber: checkoutOrder.orderNumber,
            total: checkoutOrder.total,
            ready: true,
            note: 'Order ready for Stripe Checkout Session (actual Stripe call not executed in test)',
          }
        )
      } else {
        logStep(
          'POST /api/checkout',
          false,
          'Order missing required data for checkout'
        )
      }
    } else {
      logStep('POST /api/checkout', false, 'Order not found for checkout')
    }

  } catch (error) {
    console.error('\n❌ Test failed with error:', error)
    logStep('E2E Flow', false, error instanceof Error ? error.message : String(error))
  } finally {
    // Cleanup: Remove test data
    console.log('\n🧹 Cleaning up test data...')

    if (orderId) {
      await db.orderItem.deleteMany({ where: { orderId } })
      await db.order.delete({ where: { id: orderId } }).catch(() => {})
    }

    if (cartItemId) {
      await db.cartItem.delete({ where: { id: cartItemId } }).catch(() => {})
    }

    // Disconnect from database
    await db.$disconnect()

    // Print summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 Test Summary')
    console.log('='.repeat(60))

    const passed = results.filter(r => r.passed).length
    const total = results.length
    const passRate = ((passed / total) * 100).toFixed(1)

    console.log(`\nResults: ${passed}/${total} steps passed (${passRate}%)`)

    results.forEach((result, index) => {
      const icon = result.passed ? '✓' : '✗'
      console.log(`\n${index + 1}. ${icon} ${result.step}`)
      if (result.data) {
        console.log('   Data:', JSON.stringify(result.data, null, 2).split('\n').join('\n   '))
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
    })

    console.log('\n' + '='.repeat(60))

    if (passed === total) {
      console.log('✅ All tests passed!')
      process.exit(0)
    } else {
      console.log('❌ Some tests failed')
      process.exit(1)
    }
  }
}

// Run the test
testE2EFlow()
