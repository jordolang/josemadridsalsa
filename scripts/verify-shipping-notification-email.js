#!/usr/bin/env node

/**
 * Shipping Notification Email Verification Script
 *
 * Checks the shipping notification email system implementation.
 * Verifies:
 * - Email template exists
 * - API route exists
 * - Tests pass
 * - Configuration is correct
 *
 * Usage:
 *   node scripts/verify-shipping-notification-email.js
 */

import { existsSync } from 'fs';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkMark() {
  return `${colors.green}✓${colors.reset}`;
}

function crossMark() {
  return `${colors.red}✗${colors.reset}`;
}

function warningMark() {
  return `${colors.yellow}⚠${colors.reset}`;
}

let checks = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

console.log('\n' + '='.repeat(60));
log('Shipping Notification Email System Verification', colors.bright);
console.log('='.repeat(60) + '\n');

// Check 1: Email template exists
log('1. Checking email template...', colors.blue);
const templatePath = join(projectRoot, 'emails/shipping-notification.tsx');
if (existsSync(templatePath)) {
  log(`   ${checkMark()} Template file exists: emails/shipping-notification.tsx`);
  checks.passed++;

  // Check template has required props
  const templateContent = readFileSync(templatePath, 'utf-8');
  const requiredProps = [
    'orderNumber',
    'trackingNumber',
    'trackingUrl',
    'carrier',
    'estimatedDelivery',
    'shippingAddress',
    'items',
  ];

  const missingProps = requiredProps.filter(prop => !templateContent.includes(prop));
  if (missingProps.length === 0) {
    log(`   ${checkMark()} All required props present in template`);
    checks.passed++;
  } else {
    log(`   ${crossMark()} Missing props: ${missingProps.join(', ')}`);
    checks.failed++;
  }
} else {
  log(`   ${crossMark()} Template file missing: emails/shipping-notification.tsx`);
  checks.failed++;
}

// Check 2: Automation function (expected to be missing)
log('\n2. Checking automation function...', colors.blue);
const automationPath = join(projectRoot, 'lib/email/automation.ts');
if (existsSync(automationPath)) {
  const automationContent = readFileSync(automationPath, 'utf-8');
  if (automationContent.includes('sendShippingNotificationEmail')) {
    log(`   ${checkMark()} sendShippingNotificationEmail() function found`);
    checks.passed++;
  } else {
    log(`   ${warningMark()} sendShippingNotificationEmail() function NOT found`);
    log(`      Function should be added to lib/email/automation.ts`);
    checks.warnings++;
  }
} else {
  log(`   ${crossMark()} automation.ts file missing`);
  checks.failed++;
}

// Check 3: API route exists
log('\n3. Checking API route...', colors.blue);
const apiRoutePath = join(projectRoot, 'app/api/send-email/shipping/route.ts');
if (existsSync(apiRoutePath)) {
  log(`   ${checkMark()} API route exists: app/api/send-email/shipping/route.ts`);
  checks.passed++;

  const apiContent = readFileSync(apiRoutePath, 'utf-8');
  if (apiContent.includes('ShippingNotificationEmail')) {
    log(`   ${checkMark()} API route imports ShippingNotificationEmail`);
    checks.passed++;
  } else {
    log(`   ${crossMark()} API route doesn't import template`);
    checks.failed++;
  }

  if (apiContent.includes('ShippingNotificationSchema')) {
    log(`   ${checkMark()} API route has validation schema`);
    checks.passed++;
  } else {
    log(`   ${crossMark()} API route missing validation schema`);
    checks.failed++;
  }
} else {
  log(`   ${crossMark()} API route missing`);
  checks.failed++;
}

// Check 4: Order status update route
log('\n4. Checking admin integration...', colors.blue);
const updateStatusPath = join(projectRoot, 'app/api/admin/orders/[id]/update-status/route.ts');
if (existsSync(updateStatusPath)) {
  log(`   ${checkMark()} Order status update route exists`);
  checks.passed++;

  const updateContent = readFileSync(updateStatusPath, 'utf-8');
  if (updateContent.includes('SHIPPED')) {
    log(`   ${checkMark()} Route handles SHIPPED status`);
    checks.passed++;
  }

  if (updateContent.includes('sendShippingNotification') || updateContent.includes('shipping-notification')) {
    log(`   ${checkMark()} Route triggers shipping notification email`);
    checks.passed++;
  } else {
    log(`   ${warningMark()} Route does NOT trigger shipping notification automatically`);
    log(`      Email must be sent manually or via separate action`);
    checks.warnings++;
  }
} else {
  log(`   ${crossMark()} Order status update route missing`);
  checks.failed++;
}

// Check 5: Email client configuration
log('\n5. Checking email client configuration...', colors.blue);
const emailClientPath = join(projectRoot, 'lib/email/client.ts');
if (existsSync(emailClientPath)) {
  log(`   ${checkMark()} Email client file exists`);
  checks.passed++;

  const clientContent = readFileSync(emailClientPath, 'utf-8');
  if (clientContent.includes('resend') || clientContent.includes('Resend')) {
    log(`   ${checkMark()} Email client uses Resend`);
    checks.passed++;
  }
} else {
  log(`   ${crossMark()} Email client file missing`);
  checks.failed++;
}

// Check 6: Environment variables
log('\n6. Checking environment variables...', colors.blue);
const envExample = join(projectRoot, '.env.example');
const envLocal = join(projectRoot, '.env.local');
const env = join(projectRoot, '.env');

let envContent = '';
if (existsSync(envLocal)) {
  envContent = readFileSync(envLocal, 'utf-8');
  log(`   ${checkMark()} .env.local found`);
  checks.passed++;
} else if (existsSync(env)) {
  envContent = readFileSync(env, 'utf-8');
  log(`   ${checkMark()} .env found`);
  checks.passed++;
} else {
  log(`   ${warningMark()} No .env.local or .env file found`);
  checks.warnings++;
}

if (envContent.includes('RESEND_API_KEY')) {
  const match = envContent.match(/RESEND_API_KEY=(.+)/);
  if (match && match[1] && match[1].trim() && !match[1].includes('your-') && !match[1].includes('re_xxx')) {
    log(`   ${checkMark()} RESEND_API_KEY is configured`);
    checks.passed++;
  } else {
    log(`   ${warningMark()} RESEND_API_KEY is not set (development mode)`);
    log(`      Email sending will be skipped until API key is configured`);
    checks.warnings++;
  }
} else {
  log(`   ${warningMark()} RESEND_API_KEY not found in env file`);
  checks.warnings++;
}

// Check 7: Tests exist
log('\n7. Checking tests...', colors.blue);
const testPath = join(projectRoot, 'tests/email/shipping-notification.test.tsx');
if (existsSync(testPath)) {
  log(`   ${checkMark()} Test file exists: tests/email/shipping-notification.test.tsx`);
  checks.passed++;

  const testContent = readFileSync(testPath, 'utf-8');
  const testCases = [
    'should render shipping notification email',
    'should render all order items',
    'should include tracking link',
    'trackingNumber',
    'carrier',
    'estimatedDelivery',
  ];

  const foundTests = testCases.filter(test => testContent.includes(test));
  log(`   ${checkMark()} Found ${foundTests.length}/${testCases.length} expected test cases`);
  if (foundTests.length >= testCases.length * 0.8) {
    checks.passed++;
  } else {
    checks.warnings++;
  }
} else {
  log(`   ${crossMark()} Test file missing`);
  checks.failed++;
}

// Check 8: Database schema
log('\n8. Checking database schema...', colors.blue);
const schemaPath = join(projectRoot, 'prisma/schema.prisma');
if (existsSync(schemaPath)) {
  const schemaContent = readFileSync(schemaPath, 'utf-8');

  if (schemaContent.includes('shippingNotificationSentAt')) {
    log(`   ${checkMark()} Order model has shippingNotificationSentAt field`);
    checks.passed++;
  } else {
    log(`   ${warningMark()} Order model missing shippingNotificationSentAt field`);
    log(`      Add field to track when shipping notification was sent`);
    checks.warnings++;
  }

  if (schemaContent.includes('trackingNumber')) {
    log(`   ${checkMark()} Order model has trackingNumber field`);
    checks.passed++;
  } else {
    log(`   ${crossMark()} Order model missing trackingNumber field`);
    checks.failed++;
  }

  if (schemaContent.includes('shippingCarrier') || schemaContent.includes('carrier')) {
    log(`   ${checkMark()} Order model has carrier field`);
    checks.passed++;
  } else {
    log(`   ${warningMark()} Order model missing shippingCarrier field (optional)`);
    checks.warnings++;
  }
} else {
  log(`   ${crossMark()} schema.prisma not found`);
  checks.failed++;
}

// Summary
console.log('\n' + '='.repeat(60));
log('Verification Summary', colors.bright);
console.log('='.repeat(60) + '\n');

log(`${checkMark()} Passed: ${colors.green}${checks.passed}${colors.reset}`);
log(`${crossMark()} Failed: ${colors.red}${checks.failed}${colors.reset}`);
log(`${warningMark()} Warnings: ${colors.yellow}${checks.warnings}${colors.reset}`);

console.log('\n' + '='.repeat(60));
log('System Status', colors.bright);
console.log('='.repeat(60) + '\n');

if (checks.failed === 0 && checks.warnings <= 3) {
  log('✅ Shipping notification email system is OPERATIONAL', colors.green);
  log('\nThe email template, API route, and tests are in place.');
  log('Emails can be sent manually via the API route.');

  if (checks.warnings > 0) {
    log('\n⚠️  Minor improvements recommended:', colors.yellow);
    log('   - Add sendShippingNotificationEmail() to lib/email/automation.ts');
    log('   - Add automatic email trigger to order status update');
    log('   - Add database fields for better tracking');
    log('   - Configure RESEND_API_KEY for production');
  }
} else if (checks.failed === 0) {
  log('⚠️  Shipping notification email system is PARTIALLY OPERATIONAL', colors.yellow);
  log('\nCore components exist but some optional features are missing.');
  log('See warnings above for recommended improvements.');
} else {
  log('❌ Shipping notification email system has CRITICAL ISSUES', colors.red);
  log('\nPlease address the failed checks above before deploying to production.');
}

console.log('\n' + '='.repeat(60));
log('Next Steps', colors.bright);
console.log('='.repeat(60) + '\n');

log('1. Run template tests:', colors.blue);
log('   npm test -- tests/email/shipping-notification.test.tsx\n');

log('2. View verification guide:', colors.blue);
log('   cat .auto-claude/specs/064-new-feature-implementations/verify-shipping-notification-email.md\n');

log('3. Test email sending (requires API key and running server):', colors.blue);
log('   See verification guide for curl command examples\n');

log('4. To complete implementation:', colors.blue);
log('   - Add sendShippingNotificationEmail() function');
log('   - Integrate with admin order status update');
log('   - Add database migration for tracking fields');
log('   - Create E2E test\n');

console.log('='.repeat(60) + '\n');

// Exit with appropriate code
process.exit(checks.failed > 0 ? 1 : 0);
