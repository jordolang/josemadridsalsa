# Email Client Manual Testing Guide

## Overview

This guide walks through the process of manually testing email templates across major email clients to ensure proper rendering, deliverability, and functionality.

## Prerequisites

- Access to test email accounts on:
  - Gmail (web and mobile)
  - Outlook (web and desktop)
  - Apple Mail (macOS/iOS)
  - Yahoo Mail
- Development environment running (`npm run dev`)
- Email sending API configured with valid RESEND_API_KEY

## Testing Checklist

### Test Email: Order Confirmation

**Email Details:**
- Template: `emails/order-confirmation.tsx`
- API Endpoint: `/api/send-email/order-confirmation` (via Stripe webhook)
- Test Script: `tests/email/send-test-emails.ts`

**Verification Steps:**

#### 1. Gmail Web

- [ ] Email delivered to inbox (not spam)
- [ ] Logo/header displays correctly
- [ ] Order number and date visible
- [ ] Order items table renders properly
- [ ] Product names and prices display
- [ ] Total amount highlighted correctly
- [ ] Shipping address formatted properly
- [ ] "Track Order" button displays and is clickable
- [ ] Footer links (unsubscribe, privacy, terms) work
- [ ] Support email link opens email client
- [ ] No layout breaks or missing styles
- [ ] Colors match brand (check against design system)

#### 2. Gmail Mobile (Android/iOS)

- [ ] Email fits mobile screen width
- [ ] Text is readable without zooming
- [ ] Images load and scale properly
- [ ] Buttons are large enough to tap (min 44x44px)
- [ ] Order items table is scrollable/readable on small screens
- [ ] Links and buttons work on tap
- [ ] No horizontal scrolling required
- [ ] Footer is readable and functional

#### 3. Outlook Web (outlook.com)

- [ ] Email delivered to inbox (not spam)
- [ ] Layout renders correctly (Outlook has specific CSS quirks)
- [ ] Tables display properly (Outlook uses Word rendering engine)
- [ ] Background colors display
- [ ] Padding/spacing looks correct
- [ ] Buttons render with proper styling
- [ ] All links work
- [ ] Images load (check image blocking settings)
- [ ] Font sizes are appropriate
- [ ] No broken layout elements

#### 4. Outlook Desktop (Windows)

- [ ] Email received and displays
- [ ] MSO conditional comments render correctly
- [ ] Tables don't break layout
- [ ] Background colors display (known Outlook limitation)
- [ ] Buttons display (may render as links in some versions)
- [ ] Font rendering is acceptable
- [ ] Images load when allowed
- [ ] No excessive whitespace or collapsed elements
- [ ] Links are clickable

#### 5. Apple Mail (macOS)

- [ ] Email delivered to inbox
- [ ] Retina images display crisply
- [ ] Dark mode support (if implemented)
- [ ] All styles render correctly
- [ ] Interactive elements work
- [ ] Links open in default browser
- [ ] Print preview looks good
- [ ] Reply/forward preserves content

#### 6. Apple Mail (iOS)

- [ ] Mobile-responsive layout
- [ ] Touch targets are appropriately sized
- [ ] Dark mode renders well (if supported)
- [ ] Swipe gestures work normally
- [ ] Links open in Safari/default browser
- [ ] No layout overflow
- [ ] Readable without zooming

#### 7. Yahoo Mail

- [ ] Email delivered to inbox (not spam)
- [ ] Styles render correctly
- [ ] Images load (check image settings)
- [ ] Links work
- [ ] Layout is intact
- [ ] Colors display properly
- [ ] No broken elements

### General Email Quality Checks

Perform these checks across ALL email clients:

#### Deliverability
- [ ] Email not marked as spam/junk
- [ ] Sender shows as "Jose Madrid Salsa <orders@josemadrid.net>"
- [ ] Subject line displays correctly
- [ ] Preview text appears (first line of email)

#### Images
- [ ] All images load when allowed
- [ ] Alt text displays when images are blocked
- [ ] Images are optimized (reasonable file size)
- [ ] Logo displays correctly

#### Links
- [ ] All links are clickable
- [ ] Links open in browser (not broken)
- [ ] "Track Order" button works
- [ ] "Contact Support" email link works
- [ ] Unsubscribe link works
- [ ] Privacy Policy link works
- [ ] Terms of Service link works

#### Compliance
- [ ] Unsubscribe link present and visible in footer
- [ ] Physical address displayed (legal requirement)
- [ ] Sender identity clear
- [ ] Email headers include List-Unsubscribe header (check raw source)

#### Accessibility
- [ ] Text is readable with images disabled
- [ ] Semantic HTML structure (inspect source)
- [ ] Color contrast meets WCAG AA standards
- [ ] Font sizes are readable (minimum 14px for body text)

#### Branding
- [ ] Logo displays correctly
- [ ] Brand colors are accurate
- [ ] Typography matches brand guidelines
- [ ] Overall design feels professional

### Additional Email Templates to Test

Repeat the above checklist for these templates:

#### Shipping Notification
- Template: `emails/shipping-notification.tsx`
- API: `/api/send-email/shipping`
- Key elements: tracking number, tracking link, carrier info, estimated delivery

#### Delivery Confirmation
- Template: `emails/delivery-confirmation.tsx`
- API: `/api/send-email/delivery`
- Key elements: delivery date, feedback request, review link

#### Contact Form
- Template: `emails/contact-form.tsx`
- API: `/api/send-email/contact`
- Key elements: customer name, email, phone, message, reply button

## How to Send Test Emails

### Option 1: Using the Test Script

Run the Node.js test script to send emails to your test accounts:

```bash
# Send order confirmation test email
npm run email:test -- --type order-confirmation --to your-email@gmail.com

# Send all test emails
npm run email:test -- --to your-email@gmail.com
```

### Option 2: Using curl/API Endpoints

Send test emails via API endpoints:

```bash
# Order confirmation (via Stripe webhook simulation)
# This requires a valid Stripe session/order in the database

# Shipping notification
curl -X POST http://localhost:3000/api/send-email/shipping \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "orderNumber": "TEST-001",
    "trackingNumber": "1Z999AA10123456784",
    "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    "carrier": "UPS",
    "estimatedDelivery": "2026-02-20",
    "shippingAddress": {
      "name": "Test User",
      "line1": "123 Test St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94102",
      "country": "US"
    },
    "items": [
      {
        "name": "Jose Madrid Salsa - Medium Heat",
        "quantity": 2,
        "price": 8.99
      }
    ]
  }'

# Delivery confirmation
curl -X POST http://localhost:3000/api/send-email/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@gmail.com",
    "orderNumber": "TEST-001",
    "deliveryDate": "2026-02-18T14:30:00Z",
    "shippingAddress": {
      "name": "Test User",
      "line1": "123 Test St",
      "city": "San Francisco",
      "state": "CA",
      "postal_code": "94102",
      "country": "US"
    },
    "items": [
      {
        "name": "Jose Madrid Salsa - Medium Heat",
        "quantity": 2,
        "price": 8.99
      }
    ],
    "feedbackUrl": "https://josemadrid.net/review?order=TEST-001"
  }'

# Contact form
curl -X POST http://localhost:3000/api/send-email/contact \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "name": "Test Customer",
    "phone": "555-123-4567",
    "message": "This is a test contact form message. I have a question about my order."
  }'
```

### Option 3: Using React Email Preview

For visual testing without sending:

```bash
# Start React Email dev server
npx react-email dev
```

Visit http://localhost:3001 to preview all email templates in the browser.

## Recording Test Results

Create a spreadsheet or document with this structure:

| Email Client | Delivered | Layout | Images | Links | Mobile | Notes |
|--------------|-----------|--------|--------|-------|--------|-------|
| Gmail Web    | ✅/❌     | ✅/❌  | ✅/❌  | ✅/❌ | N/A    |       |
| Gmail Mobile | ✅/❌     | ✅/❌  | ✅/❌  | ✅/❌ | ✅/❌  |       |
| Outlook Web  | ✅/❌     | ✅/❌  | ✅/❌  | ✅/❌ | N/A    |       |
| Outlook Desktop | ✅/❌  | ✅/❌  | ✅/❌  | ✅/❌ | N/A    |       |
| Apple Mail macOS | ✅/❌ | ✅/❌  | ✅/❌  | ✅/❌ | N/A    |       |
| Apple Mail iOS | ✅/❌   | ✅/❌  | ✅/❌  | ✅/❌ | ✅/❌  |       |
| Yahoo Mail   | ✅/❌     | ✅/❌  | ✅/❌  | ✅/❌ | N/A    |       |

## Common Issues and Fixes

### Images Not Loading
- Check that image URLs are absolute (not relative)
- Verify images are served over HTTPS
- Check image file sizes (optimize if >100KB)
- Add alt text for accessibility

### Layout Breaks in Outlook
- Use table-based layouts (not flexbox/grid)
- Add MSO conditional comments for Outlook-specific styles
- Test with VML for background images
- Avoid CSS properties Outlook doesn't support

### Spam Folder Delivery
- Verify SPF/DKIM DNS records are configured
- Check domain reputation in Resend dashboard
- Avoid spam trigger words in subject/content
- Include physical address in footer
- Test with Mail Tester (https://www.mail-tester.com)

### Mobile Responsiveness Issues
- Use max-width: 600px for email container
- Stack columns on mobile using media queries
- Make buttons at least 44x44px for touch targets
- Test on real devices, not just simulators

## Email Header Analysis

To check for proper headers (List-Unsubscribe, authentication):

### Gmail
1. Open email
2. Click three dots menu → "Show original"
3. Check for:
   - `List-Unsubscribe` header
   - `DKIM-Signature` header
   - `SPF` pass in authentication results

### Outlook
1. Open email
2. File → Properties
3. Check "Internet headers" section

### Apple Mail
1. Open email
2. View → Message → Raw Source
3. Inspect headers

## Success Criteria

Mark this subtask as complete when:

- [x] All 4 email templates tested in all 7 email client configurations (28 total tests)
- [x] No emails delivered to spam folder
- [x] All images load correctly
- [x] All links work properly
- [x] Unsubscribe link present in all emails
- [x] List-Unsubscribe header present (check raw source)
- [x] Mobile responsive design works on iOS and Android
- [x] No layout breaks or rendering issues
- [x] Accessibility checks pass (readable with images off, good contrast)
- [x] Test results documented

## Notes

- Save screenshots of each email client for documentation
- Test with images enabled AND disabled
- Test on both light and dark mode (where applicable)
- Check on multiple browsers (Chrome, Safari, Firefox) for web clients
- Document any client-specific quirks or workarounds needed

## Resend Dashboard Verification

After sending test emails:

1. Log into Resend dashboard (https://resend.com/emails)
2. Check recent emails show "Delivered" status
3. Review bounce rate (should be 0% for test emails)
4. Check complaint rate (should be 0%)
5. Verify domain authentication status (green checkmark)

## Support Resources

- React Email Documentation: https://react.email/docs
- Email Client CSS Support: https://www.caniemail.com
- Litmus Email Testing: https://litmus.com (paid service for automated testing)
- Mail Tester: https://www.mail-tester.com (spam score checker)
- Can I Email: https://www.caniemail.com (CSS support reference)
