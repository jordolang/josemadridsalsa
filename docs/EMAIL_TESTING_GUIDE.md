# Email Testing Guide

This guide provides instructions for manually testing the email notification system to verify delivery, rendering, and functionality.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Test Script Method](#test-script-method)
- [Manual cURL Method](#manual-curl-method)
- [Verification Checklist](#verification-checklist)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before testing, ensure you have:

1. ✅ **Environment Variables Configured**
   - `RESEND_API_KEY` - Your Resend API key
   - `FROM_EMAIL` - Sender email address (must be verified domain)
   - `SERVICE_API_KEY` - Internal service authentication key

2. ✅ **Dev Server Running**
   ```bash
   npm run dev
   ```
   Server should be available at `http://localhost:3000`

3. ✅ **Test Email Address**
   - Use a real email address you can access
   - Recommended: Use an email you can check in multiple clients (Gmail, Outlook, etc.)

## Quick Start

The fastest way to test all email endpoints:

```bash
# 1. Start the dev server (in one terminal)
npm run dev

# 2. Run the test script (in another terminal)
TEST_EMAIL=your-email@example.com npx ts-node scripts/test-emails.ts
```

The script will:
- Send test emails to all 3 endpoints
- Report success/failure for each
- Provide next steps for verification

## Test Script Method

### Option 1: Automated Test Script

The `scripts/test-emails.ts` script sends test emails to all three endpoints and reports results.

#### Usage

```bash
# Use default test email (from environment or jordolang@gmail.com)
npx ts-node scripts/test-emails.ts

# Specify custom test email
TEST_EMAIL=your-email@example.com npx ts-node scripts/test-emails.ts

# Use custom API URL (for testing staging/production)
TEST_API_URL=https://staging.josemadridsalsa.com TEST_EMAIL=you@example.com npx ts-node scripts/test-emails.ts
```

#### Expected Output

```
============================================================
🚀 Email Testing Script
============================================================

Configuration:
   API Base URL: http://localhost:3000
   Test Email: your-email@example.com
   SERVICE_API_KEY: ✓ Configured

📧 Testing Contact Form Email...
   Endpoint: http://localhost:3000/api/send-email/contact
   Recipient: your-email@example.com
   ✅ Success! Message ID: abc123...

📦 Testing Shipping Notification Email...
   Endpoint: http://localhost:3000/api/send-email/shipping
   Recipient: your-email@example.com
   ✅ Success! Message ID: def456...

📬 Testing Delivery Confirmation Email...
   Endpoint: http://localhost:3000/api/send-email/delivery
   Recipient: your-email@example.com
   ✅ Success! Message ID: ghi789...

============================================================
📊 Test Summary
============================================================

✅ Successful: 3/3
❌ Failed: 0/3

✅ Successful Tests:
   - /api/send-email/contact: abc123...
   - /api/send-email/shipping: def456...
   - /api/send-email/delivery: ghi789...

============================================================
📬 Next Steps:
============================================================

1. Check your inbox at your-email@example.com
2. Verify all emails were received
3. Check email rendering in different clients:
   - Gmail (web and mobile)
   - Outlook (web and desktop)
   - Apple Mail
4. Click unsubscribe links to verify functionality
5. Check spam folder if emails not in inbox

💡 Tip: Check the Resend dashboard for delivery details:
   https://resend.com/emails
```

## Manual cURL Method

If you prefer to test endpoints individually or don't want to use the script:

### 1. Contact Form Email

```bash
curl -X POST http://localhost:3000/api/send-email/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "your-email@example.com",
    "phone": "555-1234",
    "message": "This is a test contact form submission.",
    "submittedAt": "2026-05-12T18:00:00Z",
    "unsubscribeUrl": "http://localhost:3000/unsubscribe?token=test-token"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "abc123...",
  "from": "your-email@example.com"
}
```

### 2. Shipping Notification Email

**⚠️ Requires `x-api-key` header with SERVICE_API_KEY**

```bash
curl -X POST http://localhost:3000/api/send-email/shipping \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVICE_API_KEY" \
  -d '{
    "email": "your-email@example.com",
    "name": "Test Customer",
    "orderNumber": "TEST-12345",
    "trackingNumber": "1Z999AA10123456784",
    "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    "carrier": "UPS",
    "estimatedDelivery": "May 15, 2026",
    "shippingAddress": "123 Test Street, Test City, CA 90210",
    "items": [
      {
        "quantity": 2,
        "productName": "Jose Madrid Salsa - Mild",
        "productSku": "JM-SALSA-MILD",
        "totalPrice": 19.98
      }
    ],
    "orderId": "test-order-123",
    "userId": "test-user-456",
    "unsubscribeUrl": "http://localhost:3000/unsubscribe?token=test-token"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "def456...",
  "orderNumber": "TEST-12345"
}
```

### 3. Delivery Confirmation Email

**⚠️ Requires `x-api-key` header with SERVICE_API_KEY**

```bash
curl -X POST http://localhost:3000/api/send-email/delivery \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_SERVICE_API_KEY" \
  -d '{
    "email": "your-email@example.com",
    "name": "Test Customer",
    "orderNumber": "TEST-12345",
    "deliveryDate": "Monday, May 12, 2026",
    "shippingAddress": "123 Test Street, Test City, CA 90210",
    "items": [
      {
        "quantity": 2,
        "productName": "Jose Madrid Salsa - Mild",
        "productSku": "JM-SALSA-MILD",
        "totalPrice": 19.98
      }
    ],
    "feedbackUrl": "http://localhost:3000/feedback?order=TEST-12345",
    "orderDetailsUrl": "http://localhost:3000/orders/TEST-12345",
    "orderId": "test-order-123",
    "userId": "test-user-456",
    "unsubscribeUrl": "http://localhost:3000/unsubscribe?token=test-token"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "messageId": "ghi789...",
  "orderNumber": "TEST-12345"
}
```

## Verification Checklist

Use this checklist after sending test emails:

### ✅ Email Delivery

- [ ] Contact form email received in inbox
- [ ] Shipping notification email received in inbox
- [ ] Delivery confirmation email received in inbox
- [ ] No emails landed in spam folder
- [ ] All emails delivered within 1 minute

### ✅ Email Content Accuracy

#### Contact Form Email
- [ ] Subject line: "New Contact Form Submission from Test User"
- [ ] Sender: "Jose Madrid Salsa <mike@josemadridsalsa.com>"
- [ ] Reply-To: Test email address
- [ ] Contains name: "Test User"
- [ ] Contains email: your test email
- [ ] Contains phone: "555-1234"
- [ ] Contains message text
- [ ] Contains submission timestamp
- [ ] Unsubscribe link present in footer

#### Shipping Notification Email
- [ ] Subject line: "Your Order #TEST-12345 Has Shipped!"
- [ ] Sender: "Jose Madrid Salsa <mike@josemadridsalsa.com>"
- [ ] Reply-To: "mike@josemadridsalsa.com"
- [ ] Contains order number: TEST-12345
- [ ] Contains tracking number: 1Z999AA10123456784
- [ ] Contains carrier: UPS
- [ ] Contains estimated delivery: May 15, 2026
- [ ] Contains shipping address
- [ ] Contains order items (quantity, name, price)
- [ ] Track Package button/link works
- [ ] Unsubscribe link present in footer

#### Delivery Confirmation Email
- [ ] Subject line: "Your Order #TEST-12345 Has Been Delivered!"
- [ ] Sender: "Jose Madrid Salsa <mike@josemadridsalsa.com>"
- [ ] Reply-To: "mike@josemadridsalsa.com"
- [ ] Contains order number: TEST-12345
- [ ] Contains delivery date
- [ ] Contains shipping address
- [ ] Contains order items (quantity, name, price)
- [ ] Feedback button/link works
- [ ] Order details button/link works
- [ ] Unsubscribe link present in footer

### ✅ Email Rendering (Gmail)

Test in Gmail web and mobile:

- [ ] Email displays correctly in Gmail web interface
- [ ] Email displays correctly in Gmail mobile app (iOS/Android)
- [ ] All images load properly
- [ ] Brand colors display correctly
- [ ] Buttons are clickable and styled properly
- [ ] Text is readable (no tiny fonts)
- [ ] Email is mobile-responsive
- [ ] No layout breaks or overlapping elements
- [ ] Links all work correctly

### ✅ Email Rendering (Outlook)

Test in Outlook web and desktop:

- [ ] Email displays correctly in Outlook web interface
- [ ] Email displays correctly in Outlook desktop app (Windows/Mac)
- [ ] All images load properly
- [ ] Brand colors display correctly
- [ ] Buttons are clickable and styled properly
- [ ] Text is readable (no tiny fonts)
- [ ] Email is mobile-responsive (if using Outlook mobile)
- [ ] No layout breaks or overlapping elements
- [ ] Links all work correctly

### ✅ Email Rendering (Apple Mail)

Test in Apple Mail (macOS/iOS):

- [ ] Email displays correctly in Apple Mail on macOS
- [ ] Email displays correctly in Apple Mail on iOS
- [ ] All images load properly
- [ ] Brand colors display correctly
- [ ] Buttons are clickable and styled properly
- [ ] Text is readable (no tiny fonts)
- [ ] Email is mobile-responsive (iOS)
- [ ] No layout breaks or overlapping elements
- [ ] Links all work correctly

### ✅ Unsubscribe Functionality

- [ ] Contact form email has unsubscribe link in footer
- [ ] Shipping notification email has unsubscribe link in footer
- [ ] Delivery confirmation email has unsubscribe link in footer
- [ ] Unsubscribe links are properly formatted URLs
- [ ] Unsubscribe links include token parameter
- [ ] Clicking unsubscribe link navigates to correct page (or shows coming soon)

### ✅ Email Headers & Authentication

Check email headers (View > Show Original in Gmail):

- [ ] SPF: PASS (Resend SPF record)
- [ ] DKIM: PASS (Resend DKIM signature)
- [ ] DMARC: PASS (if configured)
- [ ] From: Domain matches FROM_EMAIL
- [ ] Return-Path: Resend bounce address
- [ ] Message-ID: Present and unique

### ✅ Resend Dashboard Verification

Check https://resend.com/emails:

- [ ] All 3 test emails appear in dashboard
- [ ] Status shows "Delivered" for all emails
- [ ] No bounce or spam complaints
- [ ] Delivery time < 1 minute
- [ ] Click details show correct metadata (orderId, userId, type)

## Troubleshooting

### Emails Not Received

**Symptom:** Test emails sent successfully but not received in inbox

**Possible Causes:**
1. Emails in spam folder
2. DNS not configured (SPF/DKIM)
3. Email address typo
4. Resend API key invalid
5. FROM_EMAIL domain not verified

**Solutions:**
```bash
# 1. Check spam folder

# 2. Verify DNS configuration
dig TXT josemadrid.net  # Check SPF record
dig TXT default._domainkey.josemadrid.net  # Check DKIM

# 3. Check Resend dashboard for delivery status
# Visit: https://resend.com/emails

# 4. Test Resend API key
curl -X POST https://api.resend.com/emails \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "onboarding@resend.dev",
    "to": "your-email@example.com",
    "subject": "Test Email",
    "html": "<p>If you receive this, your API key works!</p>"
  }'

# 5. Verify domain in Resend dashboard
# Go to: https://resend.com/domains
# Ensure domain shows "Verified" status
```

### Emails Rendering Poorly

**Symptom:** Emails received but look broken or unstyled

**Possible Causes:**
1. Email client blocking images
2. CSS not inlined properly
3. React Email template error
4. Missing email client fallbacks

**Solutions:**
1. Enable image loading in email client settings
2. Check template in React Email preview: `npx email dev`
3. Review template syntax for errors
4. Test with Litmus or Email on Acid for comprehensive client testing

### API Endpoint Errors

**Symptom:** API returns 400, 401, 429, or 500 errors

**Error Solutions:**

| Status | Error | Solution |
|--------|-------|----------|
| 400 | Validation error | Check request body matches schema |
| 401 | Unauthorized | Add `x-api-key` header with SERVICE_API_KEY (shipping/delivery only) |
| 429 | Too many requests | Wait 60 seconds and retry (rate limit) |
| 500 | Internal server error | Check server logs, verify RESEND_API_KEY is set |

**Debugging Steps:**
```bash
# 1. Check environment variables
grep RESEND_API_KEY .env.local
grep FROM_EMAIL .env.local
grep SERVICE_API_KEY .env.local

# 2. Check server logs
npm run dev  # Watch console for errors

# 3. Test with verbose curl
curl -v -X POST http://localhost:3000/api/send-email/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","message":"Test"}'

# 4. Check API endpoint directly
curl http://localhost:3000/api/send-email/contact
# Should return: 405 Method Not Allowed (confirms endpoint exists)
```

### Service API Key Issues

**Symptom:** Shipping/delivery endpoints return 401 Unauthorized

**Solution:**
```bash
# 1. Verify SERVICE_API_KEY is set in .env.local
grep SERVICE_API_KEY .env.local

# 2. If not set, generate one:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Add to .env.local:
echo 'SERVICE_API_KEY="generated_key_here"' >> .env.local

# 4. Restart dev server
npm run dev

# 5. Test with correct header:
curl -X POST http://localhost:3000/api/send-email/shipping \
  -H "Content-Type: application/json" \
  -H "x-api-key: generated_key_here" \
  -d '{ ... }'
```

## Production Testing

When testing in production or staging environments:

### Pre-Production Checklist

- [ ] DNS records configured (SPF, DKIM, DMARC)
- [ ] Domain verified in Resend dashboard
- [ ] FROM_EMAIL uses production domain
- [ ] SERVICE_API_KEY set in environment variables
- [ ] RESEND_API_KEY uses production key (not test key)
- [ ] Test with real email addresses (not test accounts)

### Production Test Commands

```bash
# Test production API
TEST_API_URL=https://www.josemadridsalsa.com \
TEST_EMAIL=your-email@example.com \
npx ts-node scripts/test-emails.ts

# Or with staging
TEST_API_URL=https://staging.josemadridsalsa.com \
TEST_EMAIL=your-email@example.com \
npx ts-node scripts/test-emails.ts
```

### Production Verification

After production testing:

1. **Check Resend Dashboard**
   - Visit https://resend.com/emails
   - Verify all test emails show "Delivered"
   - Check delivery time is < 10 seconds
   - Review email headers for authentication (SPF/DKIM PASS)

2. **Test Across Email Clients**
   - Gmail (most users)
   - Outlook (business users)
   - Apple Mail (iOS users)
   - Yahoo Mail
   - Proton Mail

3. **Test on Multiple Devices**
   - Desktop browser
   - Mobile browser
   - Native email apps (iOS Mail, Gmail app, Outlook app)

4. **Monitor Production Metrics**
   - Open rate (Resend dashboard)
   - Click-through rate (if tracking enabled)
   - Bounce rate (should be < 2%)
   - Spam complaints (should be 0%)

## Additional Resources

- **React Email Documentation**: https://react.email/docs
- **Resend Documentation**: https://resend.com/docs
- **Email System Documentation**: [EMAIL_SYSTEM.md](./EMAIL_SYSTEM.md)
- **DNS Verification Guide**: [DNS_VERIFICATION.md](./DNS_VERIFICATION.md)
- **Email Testing Tools**:
  - Litmus: https://litmus.com
  - Email on Acid: https://www.emailonacid.com
  - Mail Tester: https://www.mail-tester.com

## Support

For issues or questions:

1. Check the [EMAIL_SYSTEM.md](./EMAIL_SYSTEM.md) documentation
2. Review Resend dashboard for delivery insights
3. Check server logs for detailed error messages
4. Verify environment variables are correctly set
5. Test with Resend's example email templates first

---

**Last Updated:** 2026-05-12
**Maintained By:** Jose Madrid Salsa Engineering Team
