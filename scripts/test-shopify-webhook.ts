#!/usr/bin/env tsx
/**
 * Test Shopify Webhook Signature Verification
 * 
 * This script helps you test your Shopify webhook setup by:
 * 1. Generating a test webhook payload
 * 2. Creating a valid HMAC signature
 * 3. Sending a test request to your local webhook endpoint
 * 
 * Usage:
 *   tsx scripts/test-shopify-webhook.ts
 */

import crypto from 'crypto'

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/shopify'
const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || 'test-secret'

// Test webhook payloads for different topics
const TEST_PAYLOADS = {
  'orders/create': {
    id: 123456789,
    name: '#TEST1001',
    order_number: 1001,
    financial_status: 'pending',
    fulfillment_status: null,
    cancelled_at: null,
    closed_at: null,
    updated_at: new Date().toISOString(),
    note_attributes: [
      { name: 'orderNumber', value: 'ORD-TEST-001' }
    ],
    fulfillments: []
  },
  'orders/updated': {
    id: 123456789,
    name: '#TEST1001',
    order_number: 1001,
    financial_status: 'paid',
    fulfillment_status: 'fulfilled',
    cancelled_at: null,
    closed_at: null,
    updated_at: new Date().toISOString(),
    note_attributes: [
      { name: 'orderNumber', value: 'ORD-TEST-001' }
    ],
    fulfillments: [
      {
        tracking_number: '1Z999AA10123456784',
        tracking_company: 'UPS',
        status: 'success',
        created_at: new Date().toISOString()
      }
    ]
  },
  'orders/paid': {
    id: 123456789,
    name: '#TEST1001',
    order_number: 1001,
    financial_status: 'paid',
    fulfillment_status: null,
    cancelled_at: null,
    closed_at: null,
    updated_at: new Date().toISOString(),
    note_attributes: [
      { name: 'orderNumber', value: 'ORD-TEST-001' }
    ]
  },
  'fulfillments/create': {
    id: 987654321,
    order_id: 123456789,
    status: 'success',
    created_at: new Date().toISOString(),
    tracking_number: '1Z999AA10123456784',
    tracking_company: 'UPS'
  }
}

async function testWebhook(topic: string, payload: any) {
  console.log(`\n📦 Testing webhook: ${topic}`)
  console.log('─────────────────────────────────────')

  const body = JSON.stringify(payload)
  
  // Generate HMAC signature
  const hmac = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64')

  console.log(`📝 Payload size: ${body.length} bytes`)
  console.log(`🔐 HMAC Signature: ${hmac.substring(0, 20)}...`)

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': topic,
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Shop-Domain': 'test-store.myshopify.com',
        'X-Shopify-API-Version': '2024-10'
      },
      body
    })

    const responseText = await response.text()
    
    if (response.ok) {
      console.log(`✅ Success (${response.status})`)
      if (responseText) {
        console.log(`📄 Response: ${responseText}`)
      }
    } else {
      console.log(`❌ Failed (${response.status})`)
      console.log(`📄 Response: ${responseText}`)
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error instanceof Error ? error.message : String(error)}`)
    console.log(`\n💡 Make sure your dev server is running on port 3000`)
  }
}

async function main() {
  console.log('🧪 Shopify Webhook Test Script')
  console.log('═══════════════════════════════════════')
  console.log(`🔧 Webhook URL: ${WEBHOOK_URL}`)
  console.log(`🔑 Using secret: ${WEBHOOK_SECRET === 'test-secret' ? '⚠️  DEFAULT TEST SECRET' : '✓ Custom secret'}`)

  if (WEBHOOK_SECRET === 'test-secret' || WEBHOOK_SECRET === 'your_webhook_secret_here') {
    console.log(`\n⚠️  WARNING: Using test/placeholder secret!`)
    console.log(`   Set SHOPIFY_WEBHOOK_SECRET in .env.local for production testing`)
  }

  // Test each webhook type
  for (const [topic, payload] of Object.entries(TEST_PAYLOADS)) {
    await testWebhook(topic, payload)
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay between tests
  }

  console.log('\n═══════════════════════════════════════')
  console.log('✨ Testing complete!')
  console.log('\n📝 Next steps:')
  console.log('   1. Update SHOPIFY_STORE_DOMAIN in .env.local')
  console.log('   2. Set SHOPIFY_WEBHOOK_SECRET from Shopify Admin')
  console.log('   3. Configure webhooks in Shopify Admin → Settings → Notifications')
  console.log('   4. For local testing, use ngrok: ngrok http 3000')
}

main().catch(console.error)
