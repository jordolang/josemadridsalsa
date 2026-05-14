#!/usr/bin/env ts-node

/**
 * Email Testing Script
 *
 * This script sends test emails to all three email API endpoints
 * to verify delivery and rendering. Run after starting the dev server.
 *
 * Usage:
 *   npm run dev  # Start the dev server in one terminal
 *   npx ts-node scripts/test-emails.ts  # Run this script in another
 *
 * Or specify a custom test email:
 *   TEST_EMAIL=your-email@example.com npx ts-node scripts/test-emails.ts
 */

import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000'
const TEST_EMAIL = process.env.TEST_EMAIL || 'jordolang@gmail.com'
const SERVICE_API_KEY = process.env.SERVICE_API_KEY

interface TestResult {
  endpoint: string
  success: boolean
  messageId?: string
  error?: string
  statusCode?: number
}

const results: TestResult[] = []

/**
 * Test Contact Form Email
 */
async function testContactFormEmail(): Promise<TestResult> {
  const endpoint = '/api/send-email/contact'
  console.log(`\n📧 Testing Contact Form Email...`)
  console.log(`   Endpoint: ${API_BASE_URL}${endpoint}`)
  console.log(`   Recipient: ${TEST_EMAIL}`)

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test User',
        email: TEST_EMAIL,
        phone: '555-1234',
        message: 'This is a test contact form submission from the automated email testing script.',
        submittedAt: new Date().toISOString(),
        unsubscribeUrl: `${API_BASE_URL}/unsubscribe?token=test-token`,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`   ✅ Success! Message ID: ${data.messageId}`)
      return {
        endpoint,
        success: true,
        messageId: data.messageId,
        statusCode: response.status,
      }
    } else {
      console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`)
      return {
        endpoint,
        success: false,
        error: data.error || 'Unknown error',
        statusCode: response.status,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`   ❌ Request failed: ${errorMessage}`)
    return {
      endpoint,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Test Shipping Notification Email
 */
async function testShippingNotificationEmail(): Promise<TestResult> {
  const endpoint = '/api/send-email/shipping'
  console.log(`\n📦 Testing Shipping Notification Email...`)
  console.log(`   Endpoint: ${API_BASE_URL}${endpoint}`)
  console.log(`   Recipient: ${TEST_EMAIL}`)

  if (!SERVICE_API_KEY) {
    console.log(`   ⚠️  SERVICE_API_KEY not found - skipping`)
    return {
      endpoint,
      success: false,
      error: 'SERVICE_API_KEY not configured',
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVICE_API_KEY,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        name: 'Test Customer',
        orderNumber: 'TEST-12345',
        trackingNumber: '1Z999AA10123456784',
        trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
        carrier: 'UPS',
        estimatedDelivery: 'May 15, 2026',
        shippingAddress: '123 Test Street, Test City, CA 90210',
        items: [
          {
            quantity: 2,
            productName: 'Jose Madrid Salsa - Mild',
            productSku: 'JM-SALSA-MILD',
            totalPrice: 19.98,
          },
          {
            quantity: 1,
            productName: 'Jose Madrid Salsa - Hot',
            productSku: 'JM-SALSA-HOT',
            totalPrice: 9.99,
          },
        ],
        orderId: 'test-order-123',
        userId: 'test-user-456',
        unsubscribeUrl: `${API_BASE_URL}/unsubscribe?token=test-token`,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`   ✅ Success! Message ID: ${data.messageId}`)
      return {
        endpoint,
        success: true,
        messageId: data.messageId,
        statusCode: response.status,
      }
    } else {
      console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`)
      return {
        endpoint,
        success: false,
        error: data.error || 'Unknown error',
        statusCode: response.status,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`   ❌ Request failed: ${errorMessage}`)
    return {
      endpoint,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Test Delivery Confirmation Email
 */
async function testDeliveryConfirmationEmail(): Promise<TestResult> {
  const endpoint = '/api/send-email/delivery'
  console.log(`\n📬 Testing Delivery Confirmation Email...`)
  console.log(`   Endpoint: ${API_BASE_URL}${endpoint}`)
  console.log(`   Recipient: ${TEST_EMAIL}`)

  if (!SERVICE_API_KEY) {
    console.log(`   ⚠️  SERVICE_API_KEY not found - skipping`)
    return {
      endpoint,
      success: false,
      error: 'SERVICE_API_KEY not configured',
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SERVICE_API_KEY,
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        name: 'Test Customer',
        orderNumber: 'TEST-12345',
        deliveryDate: new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        shippingAddress: '123 Test Street, Test City, CA 90210',
        items: [
          {
            quantity: 2,
            productName: 'Jose Madrid Salsa - Mild',
            productSku: 'JM-SALSA-MILD',
            totalPrice: 19.98,
          },
          {
            quantity: 1,
            productName: 'Jose Madrid Salsa - Hot',
            productSku: 'JM-SALSA-HOT',
            totalPrice: 9.99,
          },
        ],
        feedbackUrl: `${API_BASE_URL}/feedback?order=TEST-12345`,
        orderDetailsUrl: `${API_BASE_URL}/orders/TEST-12345`,
        orderId: 'test-order-123',
        userId: 'test-user-456',
        unsubscribeUrl: `${API_BASE_URL}/unsubscribe?token=test-token`,
      }),
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log(`   ✅ Success! Message ID: ${data.messageId}`)
      return {
        endpoint,
        success: true,
        messageId: data.messageId,
        statusCode: response.status,
      }
    } else {
      console.log(`   ❌ Failed: ${data.error || 'Unknown error'}`)
      return {
        endpoint,
        success: false,
        error: data.error || 'Unknown error',
        statusCode: response.status,
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.log(`   ❌ Request failed: ${errorMessage}`)
    return {
      endpoint,
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Print summary of test results
 */
function printSummary(results: TestResult[]) {
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Summary')
  console.log('='.repeat(60))

  const successful = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  console.log(`\n✅ Successful: ${successful}/${results.length}`)
  console.log(`❌ Failed: ${failed}/${results.length}`)

  if (failed > 0) {
    console.log('\n❌ Failed Tests:')
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   - ${r.endpoint}: ${r.error}`)
      })
  }

  if (successful > 0) {
    console.log('\n✅ Successful Tests:')
    results
      .filter((r) => r.success)
      .forEach((r) => {
        console.log(`   - ${r.endpoint}: ${r.messageId}`)
      })
  }

  console.log('\n' + '='.repeat(60))
  console.log('📬 Next Steps:')
  console.log('='.repeat(60))
  console.log(`\n1. Check your inbox at ${TEST_EMAIL}`)
  console.log('2. Verify all emails were received')
  console.log('3. Check email rendering in different clients:')
  console.log('   - Gmail (web and mobile)')
  console.log('   - Outlook (web and desktop)')
  console.log('   - Apple Mail')
  console.log('4. Click unsubscribe links to verify functionality')
  console.log('5. Check spam folder if emails not in inbox')
  console.log('\n💡 Tip: Check the Resend dashboard for delivery details:')
  console.log('   https://resend.com/emails\n')
}

/**
 * Main test runner
 */
async function main() {
  console.log('='.repeat(60))
  console.log('🚀 Email Testing Script')
  console.log('='.repeat(60))
  console.log(`\nConfiguration:`)
  console.log(`   API Base URL: ${API_BASE_URL}`)
  console.log(`   Test Email: ${TEST_EMAIL}`)
  console.log(`   SERVICE_API_KEY: ${SERVICE_API_KEY ? '✓ Configured' : '✗ Not found'}`)

  // Run all tests
  results.push(await testContactFormEmail())
  results.push(await testShippingNotificationEmail())
  results.push(await testDeliveryConfirmationEmail())

  // Print summary
  printSummary(results)

  // Exit with error code if any tests failed
  const hasFailures = results.some((r) => !r.success)
  process.exit(hasFailures ? 1 : 0)
}

// Run the tests
main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
