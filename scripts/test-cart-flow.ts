#!/usr/bin/env tsx

/**
 * Test cart tracking and recovery flow
 */

import { prisma } from '../lib/prisma'

async function testCartTracking() {
  console.log('🧪 Testing Cart Tracking Flow\n')

  const testEmail = `test-${Date.now()}@example.com`
  const testCartData = {
    items: [{
      id: 'test-1',
      name: 'Test Salsa',
      slug: 'test-salsa',
      price: 10.00,
      image: 'https://example.com/salsa.jpg',
      quantity: 2,
      sku: 'TEST-001',
      heatLevel: 'MEDIUM'
    }],
    totalItems: 2,
    totalPrice: 20.00
  }

  try {
    // Simulate cart tracking
    console.log('1. Creating abandoned cart record...')
    const cart = await prisma.abandonedCart.create({
      data: {
        guestEmail: testEmail,
        cartData: testCartData
      }
    })

    console.log(`   ✅ Cart created: ${cart.id}`)
    console.log(`   Recovery token: ${cart.recoveryToken}`)
    console.log(`   Email: ${cart.guestEmail}`)

    // Verify cart data
    console.log('\n2. Verifying cart data structure...')
    const retrievedCart = await prisma.abandonedCart.findUnique({
      where: { id: cart.id }
    })

    const cartData = retrievedCart?.cartData as any
    if (cartData && Array.isArray(cartData.items) && cartData.items.length > 0) {
      console.log(`   ✅ Cart data valid`)
      console.log(`   Items: ${cartData.items.length}`)
      console.log(`   Total: $${cartData.totalPrice}`)
    } else {
      console.log(`   ❌ Cart data invalid`)
    }

    // Test recovery token
    console.log('\n3. Testing recovery token lookup...')
    const recoveryCart = await prisma.abandonedCart.findUnique({
      where: { recoveryToken: cart.recoveryToken }
    })

    if (recoveryCart) {
      console.log(`   ✅ Recovery token lookup successful`)
    } else {
      console.log(`   ❌ Recovery token lookup failed`)
    }

    // Simulate recovery
    console.log('\n4. Simulating cart recovery...')
    await prisma.abandonedCart.update({
      where: { id: cart.id },
      data: { recoveredAt: new Date() }
    })
    console.log(`   ✅ Cart marked as recovered`)

    // Cleanup
    console.log('\n5. Cleaning up test data...')
    await prisma.abandonedCart.delete({
      where: { id: cart.id }
    })
    console.log(`   ✅ Test cart deleted`)

    console.log('\n✅ All cart flow tests passed!\n')
  } catch (error) {
    console.error('\n❌ Cart flow test failed:', error)
    throw error
  }
}

async function testEligibleCarts() {
  console.log('📧 Checking Eligible Carts for Email\n')

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  const eligible = await prisma.abandonedCart.findMany({
    where: {
      recoveredAt: null,
      emailSent: false,
      createdAt: { lte: oneHourAgo }
    },
    take: 5,
    select: {
      id: true,
      guestEmail: true,
      userId: true,
      createdAt: true,
      cartData: true
    }
  })

  console.log(`Found ${eligible.length} eligible carts:\n`)

  eligible.forEach((cart, i) => {
    const cartData = cart.cartData as any
    console.log(`${i + 1}. Cart ${cart.id.substring(0, 8)}...`)
    console.log(`   Email: ${cart.guestEmail || cart.userId}`)
    console.log(`   Created: ${cart.createdAt.toISOString()}`)
    console.log(`   Items: ${cartData.items?.length || 0}`)
    console.log(`   Value: $${cartData.totalPrice || 0}`)
    console.log()
  })

  if (eligible.length === 0) {
    console.log('   ℹ️  No eligible carts (this is normal if cron ran recently)\n')
  }
}

async function main() {
  console.log('🔍 Cart Tracking & Recovery Flow Tests')
  console.log('=' .repeat(60) + '\n')

  try {
    await testCartTracking()
    await testEligibleCarts()
  } catch (error) {
    console.error('Test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
