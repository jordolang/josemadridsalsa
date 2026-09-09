# Abandoned Cart Email Sequence - Manual Verification Guide

This guide walks through manual verification of the 3-stage abandoned cart email recovery sequence.

## Overview

The sequence sends 3 emails at different intervals:
- **Stage 1** (1 hour): Gentle reminder with cart contents
- **Stage 2** (24 hours): Urgency messaging with stock warnings
- **Stage 3** (48 hours): Final chance with optional discount incentive

## Prerequisites

- Development server running: `npm run dev`
- Database seeded with test data
- Email provider configured (RESEND_API_KEY) or SMTP fallback
- Admin/developer access for cron endpoint

## Part 1: Email Preview Testing

### Step 1: Generate HTML Previews

```bash
cd apps/storefront
npm run tsx scripts/test-abandoned-cart-emails.ts
```

This generates 4 HTML preview files in `tmp/email-previews/`:
- `stage-1-reminder.html`
- `stage-2-urgency.html`
- `stage-3-final-with-discount.html`
- `stage-3-final-no-discount.html`

### Step 2: Visual Inspection

Open each HTML file in a browser and verify:

**Stage 1 - Gentle Reminder:**
- [ ] Subject: "Don't forget your salsa! 🌶️"
- [ ] Friendly, non-pushy tone
- [ ] Yellow cart total callout box
- [ ] "Complete Your Order" CTA button
- [ ] Lists brand benefits (handcrafted since 1982, fresh ingredients, etc.)
- [ ] No urgency or pressure language

**Stage 2 - Urgency:**
- [ ] Subject: "Still waiting for you! Your cart won't last forever 🌶️"
- [ ] Red warning callout: "We can't guarantee these items will still be in stock"
- [ ] "HIGH DEMAND ALERT" section
- [ ] "Secure Your Order Now" CTA (more urgent than stage 1)
- [ ] Emphasizes limited stock and popular items
- [ ] Shows hours waiting (24 hours)

**Stage 3 - Final Chance:**
- [ ] Subject: "⏰ Final Chance! Your cart expires soon 🌶️"
- [ ] Large red expiration countdown: "CART EXPIRES IN XX HOURS"
- [ ] Green discount offer section (in with-discount version)
- [ ] Discount code displayed prominently
- [ ] "Claim Your Order Now" CTA (most urgent)
- [ ] Multiple expiration warnings throughout
- [ ] WITHOUT discount version has no green section, different messaging

### Step 3: Mobile Responsiveness

For each email HTML file:

1. Open in Chrome/Firefox
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M or Cmd+Shift+M)
4. Test on these viewports:
   - iPhone SE (375px width)
   - iPhone 12 Pro (390px width)
   - iPad (768px width)
   - Desktop (1024px+ width)

Verify:
- [ ] Text is readable without zooming
- [ ] Buttons are tappable (min 44px touch target)
- [ ] No horizontal scrolling
- [ ] Images scale appropriately
- [ ] Callout boxes don't overflow
- [ ] Line breaks work well on narrow screens

## Part 2: Database & Cron Testing

### Step 1: Create Test Abandoned Cart

```bash
# Start Prisma Studio
npm run db:studio
```

In Prisma Studio:

1. Navigate to **AbandonedCart** model
2. Click "Add record"
3. Fill in:
   - `id`: `test-cart-stage-verification`
   - `sessionId`: `test-session-123`
   - `guestEmail`: `your-test-email@example.com` (use your real email to receive test emails)
   - `cartData`: `{"items":[{"id":"salsa-mild-16oz","name":"Mild Salsa 16oz","price":8.99,"quantity":2},{"id":"salsa-hot-16oz","name":"Hot Salsa 16oz","price":8.99,"quantity":3}],"total":47.85}`
   - `emailStage`: `0`
   - `emailSent`: `false`
   - `emailSentAt`: `null`
   - `recoveryToken`: Generate a UUID or use: `test-recovery-token-abc123`
   - `createdAt`: Set to 2 hours ago (e.g., `2026-09-09T12:00:00.000Z`)
   - `lastActivityAt`: Same as `createdAt`
4. Save

### Step 2: Test Stage 1 Email (1 hour)

```bash
# Trigger the cron job manually
curl -X GET "http://localhost:3000/api/cron/abandoned-cart" \
  -H "Authorization: Bearer ${CRON_SECRET}"

# Or if CRON_SECRET is in your .env.local:
curl -X GET "http://localhost:3000/api/cron/abandoned-cart?secret=your-cron-secret"
```

**Expected behavior:**
- Email sent to `guestEmail`
- Subject: "Don't forget your salsa! 🌶️"
- Gentle reminder tone
- Cart record updated:
  - `emailStage` = 1
  - `emailSent` = true
  - `emailSentAt` = current timestamp

**Verification:**
- [ ] Email received in inbox (check spam too)
- [ ] Email matches stage-1-reminder.html preview
- [ ] All variables substituted correctly (name, cart total, etc.)
- [ ] Recovery link works (click "Complete Your Order")
- [ ] Database record updated correctly

### Step 3: Test Stage 2 Email (24 hours)

Update the test cart in Prisma Studio:
- `emailStage`: `1`
- `emailSentAt`: Set to 25 hours ago (e.g., `2026-09-08T13:00:00.000Z`)

Trigger cron again:
```bash
curl -X GET "http://localhost:3000/api/cron/abandoned-cart?secret=your-cron-secret"
```

**Expected behavior:**
- Email sent with stage 2 template
- Subject: "Still waiting for you! Your cart won't last forever 🌶️"
- Urgency messaging present
- Cart record updated:
  - `emailStage` = 2
  - `emailSentAt` = current timestamp

**Verification:**
- [ ] Email received with urgency messaging
- [ ] "HIGH DEMAND ALERT" section present
- [ ] Shows "24" hours waiting
- [ ] Recovery link still works
- [ ] Different from stage 1 email

### Step 4: Test Stage 3 Email (48 hours)

Update the test cart in Prisma Studio:
- `emailStage`: `2`
- `emailSentAt`: Set to 25 hours ago (e.g., `2026-09-08T13:00:00.000Z`)

Trigger cron again:
```bash
curl -X GET "http://localhost:3000/api/cron/abandoned-cart?secret=your-cron-secret"
```

**Expected behavior:**
- Email sent with stage 3 template
- Subject: "⏰ Final Chance! Your cart expires soon 🌶️"
- Final chance messaging with expiration countdown
- Optional discount code (if configured in variables)
- Cart record updated:
  - `emailStage` = 3
  - `emailSentAt` = current timestamp

**Verification:**
- [ ] Email received with final chance messaging
- [ ] Expiration countdown prominent
- [ ] Discount section (if applicable)
- [ ] Recovery link still works
- [ ] Most urgent tone of all 3 emails

### Step 5: Test Recovery URL

Click the "Complete Your Order" button in any email.

**Expected behavior:**
- Redirects to `/api/cart/recover?token=...`
- Token validated
- If valid:
  - Cart items restored to customer's active cart
  - Redirect to `/cart` page
  - Cart shows abandoned items
- If invalid/expired:
  - Error message displayed

**Verification:**
- [ ] Recovery URL is well-formed
- [ ] Token validation works
- [ ] Cart items restored correctly
- [ ] User redirected to cart page
- [ ] Can proceed to checkout

### Step 6: Test Email Stop Conditions

**Test 1: Cart completed**
1. Complete checkout for the recovered cart
2. Trigger cron job again
3. Verify no additional emails sent

**Test 2: Cart emptied**
1. Clear all items from cart
2. Trigger cron job
3. Verify no additional emails sent

**Test 3: Unsubscribed user**
1. Create abandoned cart for user
2. Mark user as unsubscribed (add to `EmailSuppression` table with category `abandoned_cart`)
3. Trigger cron job
4. Verify no email sent, cart skipped

**Verification:**
- [ ] No emails sent after cart completion
- [ ] No emails sent for empty carts
- [ ] Unsubscribed users are respected

## Part 3: Analytics Verification

### Step 1: Create Multiple Test Carts

Create 5-10 abandoned carts at different stages:
- 3 carts at stage 0 (not sent yet)
- 2 carts at stage 1 (sent 1 hour email)
- 2 carts at stage 2 (sent 24 hour email)
- 1 cart at stage 3 (sent 48 hour email)

### Step 2: Check Admin Dashboard

Navigate to: `http://localhost:3000/admin/analytics`

**Verify:**
- [ ] Abandoned cart metrics card displays
- [ ] Total abandoned carts count correct
- [ ] Emails sent count shows breakdown by stage
- [ ] Recovery rate percentage calculated
- [ ] Chart shows abandoned vs recovered carts
- [ ] Revenue recovered amount (if any recoveries occurred)

### Step 3: Verify Per-Stage Tracking

If the analytics dashboard supports per-stage breakdown:
- [ ] Stage 1 emails sent count
- [ ] Stage 2 emails sent count
- [ ] Stage 3 emails sent count
- [ ] Recovery rate per stage (if tracked)

## Part 4: Edge Cases

### Test 1: Missing Email Address
- Create cart without `guestEmail` and no linked user
- Verify cart is skipped, no error thrown

### Test 2: Missing Recovery Token
- Create cart without `recoveryToken`
- Verify cart is skipped gracefully

### Test 3: Invalid Stage Number
- Manually set `emailStage` to 4 or -1
- Verify graceful handling (no email sent or error)

### Test 4: Concurrent Cart Processing
- Create 10+ carts eligible for email
- Trigger cron job
- Verify all processed correctly (check response: `{sent, skipped, total}`)

## Part 5: Documentation

After all manual tests pass:

- [ ] Update build-progress.txt with verification results
- [ ] Take screenshots of each email stage (optional)
- [ ] Document any issues found and resolved
- [ ] Confirm mobile responsiveness on real devices (if available)

## Common Issues & Solutions

### Email Not Received
1. Check spam/junk folder
2. Verify RESEND_API_KEY is configured
3. Check email logs in admin panel
4. Try SMTP fallback if Resend fails

### Recovery URL Doesn't Work
1. Verify `recoveryToken` is set on cart record
2. Check token format in URL
3. Ensure `/api/cart/recover` endpoint is working
4. Check browser console for errors

### Wrong Email Template Sent
1. Verify `emailStage` value in database (should be 0, 1, or 2 before sending)
2. Check cron route imports correct templates
3. Verify template selection logic: `abandonedCartStageTemplates[stage]`

### Variables Not Substituted
1. Check variable names match template (case-sensitive)
2. Verify `substituteVariables()` function is called
3. Ensure `cartTotal` is formatted correctly
4. Check for typos in variable names

## Sign-Off Checklist

Before marking subtask-3-2 as complete:

- [ ] All 3 email previews generated and reviewed
- [ ] Distinct messaging verified (reminder, urgency, final chance)
- [ ] Mobile responsiveness tested on 3+ viewport sizes
- [ ] Database test sequence completed (stage 0 → 1 → 2 → 3)
- [ ] Recovery URLs tested and working
- [ ] Email stop conditions verified (completed, emptied, unsubscribed)
- [ ] Analytics dashboard checked (if implemented)
- [ ] Edge cases tested (missing email, missing token, etc.)
- [ ] No console errors or warnings
- [ ] Documentation updated (build-progress.txt)

## Next Steps

After manual verification passes:
1. Mark subtask-3-2 as completed in implementation_plan.json
2. Proceed to subtask-3-3: Analytics verification
3. Complete phase 4: Documentation
4. Final commit and QA sign-off
