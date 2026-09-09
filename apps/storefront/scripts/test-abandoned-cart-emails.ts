#!/usr/bin/env tsx
/**
 * Manual Verification Script for Abandoned Cart Email Sequence
 *
 * This script helps verify the 3-stage abandoned cart email sequence by:
 * 1. Rendering each email stage with test data
 * 2. Saving HTML previews for manual inspection
 * 3. Testing variable substitution
 * 4. Verifying distinct messaging per stage
 *
 * Usage:
 *   npm run tsx scripts/test-abandoned-cart-emails.ts
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { abandonedCartStage1Template } from '../lib/email/templates/abandoned-cart-stage-1'
import { abandonedCartStage2Template } from '../lib/email/templates/abandoned-cart-stage-2'
import { abandonedCartStage3Template } from '../lib/email/templates/abandoned-cart-stage-3'
import { substituteVariables } from '../lib/email/sender'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

// Test data for email previews
const testData = {
  stage1: {
    name: 'Sarah Johnson',
    cartUrl: `${BASE_URL}/api/cart/recover?token=test-token-stage-1`,
    cartTotal: '$47.85',
    UNSUBSCRIBE_URL: `${BASE_URL}/unsubscribe?email=test@example.com`,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  },
  stage2: {
    name: 'Sarah Johnson',
    cartUrl: `${BASE_URL}/api/cart/recover?token=test-token-stage-2`,
    cartTotal: '$47.85',
    hoursWaiting: '24',
    UNSUBSCRIBE_URL: `${BASE_URL}/unsubscribe?email=test@example.com`,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  },
  stage3: {
    name: 'Sarah Johnson',
    cartUrl: `${BASE_URL}/api/cart/recover?token=test-token-stage-3`,
    cartTotal: '$47.85',
    discountCode: 'SAVE10',
    discountPercent: '10',
    expiresInHours: '12',
    UNSUBSCRIBE_URL: `${BASE_URL}/unsubscribe?email=test@example.com`,
    NEWSLETTER_PREFERENCES_URL: `${BASE_URL}/account/settings`,
    VIEW_IN_BROWSER_URL: '',
    FORWARD_TO_FRIEND_URL: '',
  },
}

function renderEmail(template: any, variables: Record<string, string>) {
  let html = substituteVariables(template.html, variables)

  // Handle Handlebars-style conditionals for stage 3 discount code
  if (variables.discountCode) {
    html = html.replace(/\{\{#if discountCode\}\}/g, '')
    html = html.replace(/\{\{\/if\}\}/g, '')
    html = html.replace(/\{\{else\}\}[\s\S]*?\{\{\/if\}\}/g, '')
  } else {
    // Remove conditional blocks if no discount code
    html = html.replace(/\{\{#if discountCode\}\}[\s\S]*?\{\{else\}\}/g, '')
    html = html.replace(/\{\{\/if\}\}/g, '')
  }

  return html
}

function main() {
  console.log('🧪 Abandoned Cart Email Sequence - Manual Verification')
  console.log('=' .repeat(60))
  console.log()

  // Create output directory
  const outputDir = join(process.cwd(), 'tmp', 'email-previews')
  mkdirSync(outputDir, { recursive: true })

  // Stage 1: Gentle Reminder
  console.log('📧 Stage 1: Gentle Reminder (1 hour after abandonment)')
  console.log(`   Subject: ${abandonedCartStage1Template.subject}`)
  const stage1Html = renderEmail(abandonedCartStage1Template, testData.stage1)
  const stage1Path = join(outputDir, 'stage-1-reminder.html')
  writeFileSync(stage1Path, stage1Html)
  console.log(`   ✓ Preview saved: ${stage1Path}`)
  console.log()

  // Stage 2: Urgency
  console.log('📧 Stage 2: Urgency (24 hours after abandonment)')
  console.log(`   Subject: ${abandonedCartStage2Template.subject}`)
  const stage2Html = renderEmail(abandonedCartStage2Template, testData.stage2)
  const stage2Path = join(outputDir, 'stage-2-urgency.html')
  writeFileSync(stage2Path, stage2Html)
  console.log(`   ✓ Preview saved: ${stage2Path}`)
  console.log()

  // Stage 3: Final Chance (with discount)
  console.log('📧 Stage 3: Final Chance with Discount (48 hours)')
  console.log(`   Subject: ${abandonedCartStage3Template.subject}`)
  const stage3Html = renderEmail(abandonedCartStage3Template, testData.stage3)
  const stage3Path = join(outputDir, 'stage-3-final-with-discount.html')
  writeFileSync(stage3Path, stage3Html)
  console.log(`   ✓ Preview saved: ${stage3Path}`)
  console.log()

  // Stage 3: Final Chance (without discount)
  console.log('📧 Stage 3: Final Chance without Discount (48 hours)')
  const stage3NoDiscountData = { ...testData.stage3, discountCode: '', discountPercent: '' }
  const stage3NoDiscountHtml = renderEmail(abandonedCartStage3Template, stage3NoDiscountData)
  const stage3NoDiscountPath = join(outputDir, 'stage-3-final-no-discount.html')
  writeFileSync(stage3NoDiscountPath, stage3NoDiscountHtml)
  console.log(`   ✓ Preview saved: ${stage3NoDiscountPath}`)
  console.log()

  // Verification checklist
  console.log('✅ Verification Checklist:')
  console.log('=' .repeat(60))
  console.log()
  console.log('1. Distinct Messaging:')
  console.log('   □ Stage 1 has friendly, gentle reminder tone')
  console.log('   □ Stage 2 has urgency messaging (stock warnings, time pressure)')
  console.log('   □ Stage 3 has final chance messaging (expiration countdown)')
  console.log()
  console.log('2. Visual Rendering:')
  console.log('   □ Open each HTML file in a browser')
  console.log('   □ Check that José Madrid branding is consistent')
  console.log('   □ Verify all variables are substituted (no {{...}} remaining)')
  console.log('   □ Confirm CTAs are prominent and actionable')
  console.log()
  console.log('3. Mobile Responsiveness:')
  console.log('   □ Open browser DevTools (F12)')
  console.log('   □ Toggle device toolbar (Ctrl+Shift+M / Cmd+Shift+M)')
  console.log('   □ Test on iPhone SE (375px), iPhone 12 (390px), iPad (768px)')
  console.log('   □ Verify text is readable, buttons are tappable')
  console.log('   □ Check that images scale properly')
  console.log()
  console.log('4. Recovery URLs:')
  console.log('   □ Click the CTA button in each preview')
  console.log('   □ Verify URL format: /api/cart/recover?token=...')
  console.log('   □ Test with real token (see database testing steps below)')
  console.log()
  console.log('5. Conditional Content (Stage 3):')
  console.log('   □ Compare stage-3-final-with-discount.html')
  console.log('   □ Compare stage-3-final-no-discount.html')
  console.log('   □ Verify discount section appears/disappears correctly')
  console.log()
  console.log('📁 Preview files location:')
  console.log(`   ${outputDir}`)
  console.log()
  console.log('🔬 Next: Database Testing')
  console.log('   See MANUAL-VERIFICATION.md for instructions on testing')
  console.log('   the full sequence with real database records and cron triggers.')
  console.log()
}

main()
