#!/bin/bash

# Order Confirmation Email Configuration Check
# Simple shell script to verify email system configuration

echo "=================================="
echo "Email System Configuration Check"
echo "=================================="
echo ""

# Check 1: RESEND_API_KEY
echo "1. Checking RESEND_API_KEY..."
if [ -n "$RESEND_API_KEY" ]; then
  echo "   ✓ RESEND_API_KEY is configured"
else
  echo "   ✗ RESEND_API_KEY is NOT configured"
  echo "   Set in .env or .env.local:"
  echo "   RESEND_API_KEY=re_xxxxxxxxxxxxx"
fi
echo ""

# Check 2: FROM_EMAIL
echo "2. Checking FROM_EMAIL..."
FROM_EMAIL="${FROM_EMAIL:-Jose Madrid Salsa <mike@josemadrid.net>}"
echo "   ℹ FROM_EMAIL: $FROM_EMAIL"
echo ""

# Check 3: Base URL
echo "3. Checking BASE_URL..."
BASE_URL="${NEXT_PUBLIC_BASE_URL:-${NEXTAUTH_URL:-https://www.josemadridsalsa.com}}"
echo "   ℹ BASE_URL: $BASE_URL"
echo ""

# Check 4: Email template file exists
echo "4. Checking email template file..."
if [ -f "emails/order-confirmation.tsx" ]; then
  echo "   ✓ emails/order-confirmation.tsx exists"
else
  echo "   ✗ emails/order-confirmation.tsx NOT found"
fi
echo ""

# Check 5: Email automation file exists
echo "5. Checking email automation..."
if [ -f "lib/email/automation.ts" ]; then
  echo "   ✓ lib/email/automation.ts exists"
  # Check if sendOrderConfirmationEmail is defined
  if grep -q "sendOrderConfirmationEmail" lib/email/automation.ts; then
    echo "   ✓ sendOrderConfirmationEmail function is defined"
  else
    echo "   ✗ sendOrderConfirmationEmail function NOT found"
  fi
else
  echo "   ✗ lib/email/automation.ts NOT found"
fi
echo ""

# Check 6: Webhook integration
echo "6. Checking webhook integration..."
if [ -f "lib/stripe/webhooks.ts" ]; then
  echo "   ✓ lib/stripe/webhooks.ts exists"
  if grep -q "sendOrderConfirmationEmail" lib/stripe/webhooks.ts; then
    echo "   ✓ Stripe webhook calls sendOrderConfirmationEmail"
  else
    echo "   ✗ Stripe webhook does NOT call sendOrderConfirmationEmail"
  fi
else
  echo "   ✗ lib/stripe/webhooks.ts NOT found"
fi
echo ""

# Check 7: Dependencies
echo "7. Checking dependencies..."
if command -v npm &> /dev/null; then
  if npm list @react-email/render @react-email/components resend &> /dev/null; then
    echo "   ✓ Email dependencies are installed"
  else
    echo "   ⚠ Some email dependencies may be missing"
    echo "   Run: npm install"
  fi
else
  echo "   ⚠ npm not found, cannot check dependencies"
fi
echo ""

# Summary
echo "=================================="
echo "Summary"
echo "=================================="
echo ""

if [ -n "$RESEND_API_KEY" ] && [ -f "emails/order-confirmation.tsx" ] && [ -f "lib/email/automation.ts" ]; then
  echo "✓ Email system appears to be configured correctly!"
  echo ""
  echo "Next steps:"
  echo "  1. Run tests: npm test -- tests/email/order-confirmation.test.tsx"
  echo "  2. Run E2E tests: npm test -- tests/e2e/checkout-email-flow.test.ts"
  echo "  3. Check Resend dashboard: https://resend.com/emails"
  echo "  4. Review verification guide:"
  echo "     .auto-claude/specs/064-new-feature-implementations/verify-order-confirmation-email.md"
else
  echo "⚠ Email system may have configuration issues"
  echo ""
  echo "Required actions:"
  if [ -z "$RESEND_API_KEY" ]; then
    echo "  - Set RESEND_API_KEY in .env or .env.local"
  fi
  if [ ! -f "emails/order-confirmation.tsx" ]; then
    echo "  - Create email template: emails/order-confirmation.tsx"
  fi
  if [ ! -f "lib/email/automation.ts" ]; then
    echo "  - Create email automation: lib/email/automation.ts"
  fi
fi
echo ""
