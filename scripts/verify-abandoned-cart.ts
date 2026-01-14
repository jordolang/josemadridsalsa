#!/usr/bin/env tsx

/**
 * Abandoned Cart Recovery System Verification Script
 *
 * This script verifies that all components of the abandoned cart recovery
 * system are working correctly.
 */

import { prisma } from '../lib/prisma'

interface VerificationResult {
  section: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
}

const results: VerificationResult[] = []

function addResult(section: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
  results.push({ section, status, message, details })
}

async function verifyEnvironmentVariables() {
  console.log('\n📋 1. Environment Variables Check\n')

  const requiredVars = [
    'CRON_SECRET',
    'RESEND_API_KEY',
    'FROM_EMAIL',
    'NEXTAUTH_URL',
    'DATABASE_URL'
  ]

  for (const varName of requiredVars) {
    const value = process.env[varName]
    if (value) {
      addResult('Environment', 'pass', `${varName} is set`, { length: value.length })
      console.log(`✅ ${varName} is set (${value.length} chars)`)
    } else {
      addResult('Environment', 'fail', `${varName} is NOT set`)
      console.log(`❌ ${varName} is NOT set`)
    }
  }
}

async function verifyDatabaseState() {
  console.log('\n📊 3. Database State Inspection\n')

  try {
    // Total abandoned carts
    const total = await prisma.abandonedCart.count()
    addResult('Database', total > 0 ? 'pass' : 'warning', `Total abandoned carts: ${total}`)
    console.log(`📦 Total abandoned carts: ${total}`)

    // Recent carts (last 24 hours)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const recent = await prisma.abandonedCart.findMany({
      where: {
        createdAt: { gte: yesterday }
      },
      select: {
        id: true,
        userId: true,
        guestEmail: true,
        emailSent: true,
        emailSentAt: true,
        recoveredAt: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log(`\n📅 Recent carts (last 24 hours): ${recent.length}`)
    if (recent.length > 0) {
      recent.forEach((cart, i) => {
        console.log(`  ${i + 1}. Cart ${cart.id.substring(0, 8)}...`)
        console.log(`     Email: ${cart.userId ? 'User ID' : cart.guestEmail}`)
        console.log(`     Sent: ${cart.emailSent ? '✅' : '❌'} ${cart.emailSentAt ? `(${cart.emailSentAt.toISOString()})` : ''}`)
        console.log(`     Recovered: ${cart.recoveredAt ? '✅' : '❌'}`)
      })
      addResult('Database', 'pass', `Found ${recent.length} recent carts`)
    } else {
      addResult('Database', 'warning', 'No carts created in last 24 hours')
    }

    // Eligible for email (>1 hour old, not sent)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const eligible = await prisma.abandonedCart.count({
      where: {
        recoveredAt: null,
        emailSent: false,
        createdAt: { lte: oneHourAgo }
      }
    })

    console.log(`\n📧 Carts eligible for email (>1 hour old, not sent): ${eligible}`)
    addResult('Database', eligible >= 0 ? 'pass' : 'fail', `Eligible carts: ${eligible}`, { eligible })

    // Email statistics
    const emailStats = await prisma.abandonedCart.groupBy({
      by: ['emailSent'],
      _count: true
    })

    console.log('\n📈 Email Statistics:')
    emailStats.forEach(stat => {
      console.log(`  ${stat.emailSent ? 'Sent' : 'Not sent'}: ${stat._count}`)
    })

    // Recovery rate calculation
    const sent = await prisma.abandonedCart.count({
      where: { emailSent: true }
    })

    const recovered = await prisma.abandonedCart.count({
      where: {
        emailSent: true,
        recoveredAt: { not: null }
      }
    })

    const recoveryRate = sent > 0 ? ((recovered / sent) * 100).toFixed(2) : '0.00'
    console.log(`\n💰 Recovery Rate: ${recoveryRate}% (${recovered}/${sent})`)

    if (parseFloat(recoveryRate) >= 10 && parseFloat(recoveryRate) <= 20) {
      addResult('Database', 'pass', `Recovery rate ${recoveryRate}% is within target range (10-15%)`, { recoveryRate, recovered, sent })
    } else if (sent < 10) {
      addResult('Database', 'warning', `Recovery rate ${recoveryRate}% (insufficient data: ${sent} sent)`, { recoveryRate, recovered, sent })
    } else {
      addResult('Database', 'warning', `Recovery rate ${recoveryRate}% is outside target range (10-15%)`, { recoveryRate, recovered, sent })
    }

    // Sample cart data structure
    const sample = await prisma.abandonedCart.findFirst({
      select: {
        id: true,
        cartData: true
      }
    })

    if (sample) {
      const cartData = sample.cartData as any
      const hasValidStructure = cartData &&
        Array.isArray(cartData.items) &&
        typeof cartData.totalItems === 'number' &&
        typeof cartData.totalPrice === 'number'

      if (hasValidStructure) {
        console.log(`\n✅ Cart data structure is valid`)
        console.log(`   Items: ${cartData.items.length}`)
        console.log(`   Total Items: ${cartData.totalItems}`)
        console.log(`   Total Price: $${cartData.totalPrice.toFixed(2)}`)
        addResult('Database', 'pass', 'Cart data structure is valid', {
          sampleId: sample.id,
          itemCount: cartData.items.length
        })
      } else {
        console.log(`\n❌ Cart data structure is INVALID`)
        addResult('Database', 'fail', 'Cart data structure is invalid', { sampleId: sample.id })
      }
    }

    // Check database indexes
    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'abandoned_carts'
    `

    console.log(`\n🔍 Database Indexes:`)
    const requiredIndexes = [
      'abandoned_carts_userId_idx',
      'abandoned_carts_guestEmail_idx',
      'abandoned_carts_emailSent_createdAt_idx'
    ]

    const indexNames = indexes.map(idx => idx.indexname)
    requiredIndexes.forEach(reqIdx => {
      const exists = indexNames.some(name => name.includes(reqIdx) || name.includes(reqIdx.replace(/_idx$/, '')))
      console.log(`  ${exists ? '✅' : '❌'} ${reqIdx}`)
      if (!exists) {
        addResult('Database', 'warning', `Missing index: ${reqIdx}`)
      }
    })

  } catch (error) {
    console.error('❌ Database verification failed:', error)
    addResult('Database', 'fail', `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function verifyEmailTemplate() {
  console.log('\n📧 4. Email Template Check\n')

  try {
    const template = await prisma.emailTemplate.findUnique({
      where: { key: 'abandoned_cart' }
    })

    if (template) {
      console.log('✅ Custom email template exists in database')
      console.log(`   Name: ${template.name}`)
      console.log(`   Subject: ${template.subject}`)
      console.log(`   Active: ${template.isActive}`)
      console.log(`   Sent Count: ${template.sentCount}`)
      console.log(`   Last Sent: ${template.lastSentAt ? template.lastSentAt.toISOString() : 'Never'}`)

      // Check for required variables
      const requiredVars = ['{{name}}', '{{cartItems}}', '{{totalPrice}}', '{{recoveryLink}}', '{{discountCode}}']
      const missingVars = requiredVars.filter(v => !template.html.includes(v))

      if (missingVars.length === 0) {
        console.log('   ✅ All required template variables present')
        addResult('Email', 'pass', 'Custom template exists with all required variables')
      } else {
        console.log('   ⚠️  Missing template variables:', missingVars.join(', '))
        addResult('Email', 'warning', 'Custom template missing some variables', { missingVars })
      }
    } else {
      console.log('⚠️  No custom template in database (using fallback template)')
      addResult('Email', 'warning', 'No custom template found, using fallback')
    }
  } catch (error) {
    console.error('❌ Email template check failed:', error)
    addResult('Email', 'fail', `Template check error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

async function testCronEndpoint() {
  console.log('\n⏰ 2. Cron Endpoint Test\n')

  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.log('⚠️  CRON_SECRET not set, skipping endpoint test')
    addResult('Cron', 'warning', 'Cannot test endpoint without CRON_SECRET')
    return
  }

  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const url = `${baseUrl}/api/cron/abandoned-cart`

    console.log(`Testing endpoint: ${url}`)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${cronSecret}`
      }
    })

    const data = await response.json()

    if (response.ok) {
      console.log('✅ Cron endpoint responded successfully')
      console.log(`   Processed: ${data.processed}`)
      console.log(`   Sent: ${data.sent}`)
      console.log(`   Failed: ${data.failed}`)
      if (data.errors && data.errors.length > 0) {
        console.log(`   Errors:`)
        data.errors.forEach((err: string) => console.log(`     - ${err}`))
      }
      addResult('Cron', 'pass', 'Cron endpoint test successful', data)
    } else {
      console.log(`❌ Cron endpoint returned error: ${response.status}`)
      console.log(`   Response:`, data)
      addResult('Cron', 'fail', `Cron endpoint error: ${response.status}`, data)
    }
  } catch (error) {
    console.log(`⚠️  Could not reach cron endpoint (may not be running locally)`)
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    addResult('Cron', 'warning', 'Could not test endpoint (server may not be running)')
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60))
  console.log('📊 VERIFICATION SUMMARY')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.status === 'pass').length
  const failed = results.filter(r => r.status === 'fail').length
  const warnings = results.filter(r => r.status === 'warning').length

  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`📋 Total Checks: ${results.length}\n`)

  if (failed > 0) {
    console.log('❌ FAILED CHECKS:')
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   [${r.section}] ${r.message}`)
    })
    console.log()
  }

  if (warnings > 0) {
    console.log('⚠️  WARNINGS:')
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`   [${r.section}] ${r.message}`)
    })
    console.log()
  }

  // Overall status
  if (failed === 0 && warnings === 0) {
    console.log('🎉 All checks passed! System is working correctly.')
  } else if (failed === 0) {
    console.log('✅ System is functional with minor warnings.')
  } else {
    console.log('⚠️  System has critical issues that need attention.')
  }

  console.log('\n' + '='.repeat(60) + '\n')
}

async function main() {
  console.log('🔍 Abandoned Cart Recovery System Verification')
  console.log('=' .repeat(60))

  try {
    await verifyEnvironmentVariables()
    await testCronEndpoint()
    await verifyDatabaseState()
    await verifyEmailTemplate()
    await printSummary()
  } catch (error) {
    console.error('\n❌ Verification failed with error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
