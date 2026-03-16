# Fundraising Campaign - Manual Testing Guide

This guide provides step-by-step instructions for manually verifying the complete fundraising campaign workflow.

## Prerequisites

- Development server running (`npm run dev`)
- Database accessible with migrations applied
- Admin user account created
- At least one product available in the system
- Email service configured (or check logs for email sends)

## Test Campaign Setup

### Step 1: Create New Fundraiser Campaign

**Goal:** Verify admin can create a fundraising campaign with all required fields.

1. Navigate to `/admin/fundraisers`
2. Click "New Fundraiser" or "Create Campaign" button
3. Fill in campaign details:
   - **Name:** Spring Fundraiser 2024
   - **Slug:** spring-fundraiser-2024 (auto-generated)
   - **Organization Name:** Lincoln Elementary PTA
   - **Contact Name:** Sarah Johnson
   - **Contact Email:** sarah@lincoln-pta.org
   - **Contact Phone:** (503) 555-0123
   - **Description:** Support our school programs with delicious salsa!
   - **Start Date:** Select a date in the near future
   - **End Date:** Select a date 30 days after start
   - **Goal Amount:** $5,000.00
   - **Commission Rate:** 40%
   - **Status:** ACTIVE
4. Click "Create Fundraiser"

**Expected Results:**
- ✅ Form validation works (required fields highlighted if missing)
- ✅ Slug auto-generates from campaign name
- ✅ Campaign is created successfully
- ✅ Redirected to campaign detail page
- ✅ Success message displayed
- ✅ Campaign appears in fundraisers list

---

### Step 2: Add Participants to Campaign

**Goal:** Verify admin can add multiple participants and each receives welcome email.

1. From campaign detail page, navigate to "Participants" tab
2. Click "Add Participant" button
3. Add first participant:
   - **Name:** Alice Smith
   - **Email:** alice.smith@example.com (use real email if testing emails)
   - **Phone:** (503) 555-1001
   - Click "Add Participant"
4. Repeat for two more participants:
   - **Participant 2:** Bob Martinez, bob.martinez@example.com, (503) 555-1002
   - **Participant 3:** Carol Davis, carol.davis@example.com, (503) 555-1003

**Expected Results:**
- ✅ Each participant is added successfully
- ✅ Unique referral code generated for each (format: FR-XXXX-XXXX)
- ✅ Participants appear in list with their referral codes
- ✅ Each participant starts with 0 orders, $0 revenue, $0 commission
- ✅ Copy referral link buttons appear and work
- ✅ Duplicate email detection works (try adding same email twice)

---

### Step 3: Verify Participant Welcome Emails

**Goal:** Confirm welcome emails sent with referral links.

1. Check email inbox for each participant email address
   - OR check server logs for email send confirmations
   - OR check database `EmailLog` table if implemented
2. Verify email contains:
   - Personalized greeting with participant name
   - Campaign name and details
   - Unique referral link
   - Dashboard link with referral code
   - Instructions on how to share

**Expected Results:**
- ✅ Each participant receives welcome email
- ✅ Email contains correct referral code/link
- ✅ Email is well-formatted and mobile-friendly
- ✅ Links in email are clickable and correct

**Email Content Checklist:**
- [ ] Subject line mentions campaign name
- [ ] Participant name appears in greeting
- [ ] Referral link is complete: `https://yourdomain.com/fundraisers/spring-fundraiser-2024/FR-XXXX-XXXX`
- [ ] Dashboard link present
- [ ] Sharing tips included

---

### Step 4: Supporter Visits Participant Referral Link

**Goal:** Verify referral tracking works when supporter clicks participant's link.

1. Copy referral link for Alice Smith (Participant 1)
   - Format: `/fundraisers/spring-fundraiser-2024/FR-XXXX-XXXX`
2. Open link in **new incognito/private browser window**
3. Observe the page

**Expected Results:**
- ✅ Campaign landing page loads successfully
- ✅ Personalized header shows: "Support Alice Smith!"
- ✅ Campaign name and organization displayed
- ✅ Campaign description shown
- ✅ Product grid displays available products
- ✅ Progress bar shows campaign goal progress
- ✅ Campaign dates and contact info visible
- ✅ Referral code stored in cookie (check browser DevTools → Application → Cookies)
  - Cookie name: `fundraiser_referral_code`
  - Cookie value: `FR-XXXX-XXXX` (Alice's code)
  - Cookie expires in 30 days

**Visual Checklist:**
- [ ] Hero section with "Support [Participant Name]" message
- [ ] Campaign stats cards (dates, participants, orders)
- [ ] Progress bar toward goal
- [ ] Product grid with at least one product
- [ ] "How it works" section
- [ ] Contact coordinator button
- [ ] Mobile responsive (test on phone or resize browser)

---

### Step 5: Supporter Completes Order

**Goal:** Verify supporter can complete checkout with referral attribution.

1. Still in incognito window with referral link loaded
2. Add products to cart:
   - Add 3 jars of "Mild Salsa" to cart
   - Add 2 jars of "Hot Salsa" to cart
3. Navigate to cart
4. Proceed to checkout
5. Fill in shipping information:
   - **Name:** John Supporter
   - **Email:** john.supporter@example.com
   - **Address:** 123 Main Street, Portland, OR 97201
6. Select shipping method
7. Enter test payment information (Stripe test card):
   - **Card:** 4242 4242 4242 4242
   - **Expiry:** 12/34
   - **CVC:** 123
8. Complete checkout

**Expected Results:**
- ✅ Cart displays correctly with selected products
- ✅ Checkout form accepts all fields
- ✅ Shipping calculated correctly
- ✅ Tax calculated if applicable
- ✅ Payment processes successfully
- ✅ Order confirmation page displays
- ✅ Order confirmation email sent to supporter

---

### Step 6: Verify Order Attribution to Participant

**Goal:** Confirm order is correctly attributed to Alice Smith.

1. Go to Admin → Orders
2. Find the order just placed (most recent)
3. Click to view order details
4. Check order details

**Expected Results:**
- ✅ Order has `participantId` set to Alice Smith's ID
- ✅ Order has `fundraiserId` set to campaign ID
- ✅ Order details page shows:
  - Participant name: Alice Smith
  - Referral code: FR-XXXX-XXXX (Alice's code)
  - Fundraiser name: Spring Fundraiser 2024

**Database Verification (Optional):**
```sql
SELECT
  o.id,
  o.orderNumber,
  o.total,
  o.participantId,
  fp.name as participantName,
  fp.referralCode
FROM "Order" o
LEFT JOIN "FundraiserParticipant" fp ON o.participantId = fp.id
WHERE o.id = 'order-id-from-step-5'
```

Expected: `participantId` and `participantName` should show Alice Smith.

---

### Step 7: Verify Participant Totals Updated

**Goal:** Confirm Alice Smith's stats updated with new order.

1. Navigate to `/admin/fundraisers/[id]/participants`
2. Find Alice Smith in participant list
3. Verify her stats:

**Expected Results:**
- ✅ **Total Orders:** 1
- ✅ **Total Revenue:** $XX.XX (order total from Step 5)
- ✅ **Total Commission:** $YY.YY (order total × 40% commission rate)

**Example Calculation:**
- If order total = $125.00
- Commission rate = 40%
- Commission earned = $125.00 × 0.40 = $50.00

4. Click on Alice Smith's name to view detail page
5. Verify detail page shows:
   - Stats cards with updated totals
   - Order history with the new order listed
   - Commission amount correct

---

### Step 8: Verify Campaign Dashboard Reflects New Order

**Goal:** Confirm campaign dashboard shows updated stats.

1. Navigate to `/admin/fundraisers/[id]` (campaign detail page)
2. Check Overview tab:

**Expected Results:**
- ✅ Total Orders increased by 1
- ✅ Total Revenue increased by order amount
- ✅ Total Commission increased by calculated commission
- ✅ Progress bar updated (shows percentage toward goal)
- ✅ Recent orders list shows new order
- ✅ Participant count = 3

3. Check Analytics tab (if available):
   - ✅ Revenue timeline chart shows data point for today
   - ✅ Top participants chart shows Alice with sales

4. Check Leaderboard tab:
   - ✅ Alice Smith appears in leaderboard
   - ✅ Revenue amount correct
   - ✅ Other participants show $0

---

### Step 9: Verify Participant Dashboard Shows Order

**Goal:** Confirm participant can view their own dashboard without login.

1. Navigate to participant dashboard:
   - URL: `/fundraisers/spring-fundraiser-2024/dashboard/FR-XXXX-XXXX`
   - Replace FR-XXXX-XXXX with Alice's referral code
2. View dashboard as participant would see it

**Expected Results:**
- ✅ Dashboard loads without requiring login
- ✅ Personalized header: "Alice Smith's Dashboard"
- ✅ Campaign name displayed
- ✅ Stats cards show:
  - Total Orders: 1
  - Total Revenue: $XX.XX
  - Commission Earned: $YY.YY
- ✅ Referral link prominently displayed with:
  - Full URL
  - Copy button
  - QR code option
- ✅ Orders list shows recent order with:
  - Order number
  - Date
  - Status
  - Total
  - Commission earned for that order
  - Product details
- ✅ Sharing tips section displayed
- ✅ Campaign info card shows commission rate and status

**Mobile Responsiveness:**
- [ ] Test on mobile device or resize browser
- [ ] All sections stack vertically
- [ ] Stats cards readable
- [ ] Referral link copy button works
- [ ] QR code displays correctly

---

### Step 10: Campaign End & Summary Email

**Goal:** Verify campaign can be ended and summary email sent.

1. Navigate to `/admin/fundraisers/[id]/edit`
2. Change campaign status to "ENDED" or set `isActive = false`
3. Save changes
4. Check coordinator email (sarah@lincoln-pta.org)

**Expected Results:**
- ✅ Campaign status updates to ENDED
- ✅ Campaign no longer shows as active on public pages
- ✅ Summary email sent to coordinator containing:
  - Campaign name and dates
  - Total orders count
  - Total revenue raised
  - Total commission to be paid
  - Participant count
  - Top 5 participants by revenue
  - Thank you message
  - Dashboard link for final review

**Summary Email Content Checklist:**
- [ ] Subject: "[Campaign Name] - Final Results"
- [ ] Coordinator name in greeting
- [ ] Campaign totals accurate
- [ ] Top participants list (max 5)
- [ ] Each participant's name, orders, and revenue
- [ ] Link to campaign dashboard
- [ ] Next steps or payout information

---

## Additional Test Scenarios

### Test 11: Multiple Orders from Same Supporter

1. Using same incognito session (cookie preserved)
2. Place another order
3. Verify both orders attributed to Alice Smith
4. Verify totals cumulative

### Test 12: Different Participant Orders

1. Open new incognito window
2. Use Bob Martinez's referral link (Participant 2)
3. Place order
4. Verify:
   - Order attributed to Bob, NOT Alice
   - Bob's stats update
   - Alice's stats unchanged
   - Campaign totals include both

### Test 13: Order Without Referral Code

1. Open new incognito window
2. Visit campaign page directly (no referral code)
3. Place order
4. Verify:
   - Order has `fundraiserId` but no `participantId`
   - Campaign totals update
   - No participant gets credit

### Test 14: Milestone Email (1st Sale)

1. Add new participant with no prior sales
2. Have supporter use their referral link
3. Complete order (participant's first sale)
4. Check participant's email
5. Verify milestone congratulations email sent

### Test 15: Referral Link Sharing

1. From participant dashboard, click "Copy Link"
2. Verify link copied to clipboard
3. Click "Share" button (if Web Share API supported)
4. Verify share dialog opens with referral link
5. Click "View QR Code"
6. Verify QR code displays and is scannable

### Test 16: Commission Calculation Edge Cases

Test various order amounts:
- Small order: $10.00 → Commission: $4.00 (40%)
- Large order: $500.00 → Commission: $200.00 (40%)
- Order with decimals: $125.50 → Commission: $50.20 (40%)
- Order with shipping/tax: Verify commission on correct base amount

### Test 17: Campaign Goal Progress

1. Note current progress percentage
2. Place orders totaling close to goal
3. Verify progress bar approaches 100%
4. Place order exceeding goal
5. Verify progress can exceed 100%
6. Verify visual indication when goal reached

---

## Test Data Summary

After completing all tests, you should have:

- ✅ 1 active campaign (Spring Fundraiser 2024)
- ✅ 3 participants (Alice, Bob, Carol)
- ✅ At least 3 orders placed
- ✅ At least 2 participants with sales
- ✅ Campaign revenue > $0
- ✅ Email logs showing:
  - 3 welcome emails sent
  - At least 1 order confirmation email
  - At least 1 milestone email
  - 1 campaign summary email

---

## Regression Checks

### Admin Permissions
- [ ] Non-admin users cannot access `/admin/fundraisers`
- [ ] Non-admin users cannot create/edit campaigns
- [ ] Non-admin users cannot add participants

### Data Integrity
- [ ] Referral codes are unique across all participants
- [ ] Order totals match cart calculations
- [ ] Commission percentages calculate correctly
- [ ] Participant totals = sum of their orders
- [ ] Campaign totals = sum of all participant totals

### Error Handling
- [ ] Invalid referral code shows 404 or appropriate error
- [ ] Expired campaign shows appropriate message
- [ ] Duplicate participant email rejected with clear error
- [ ] Invalid form data shows validation errors

### Performance
- [ ] Campaign dashboard loads within 2 seconds
- [ ] Participant list with 50+ participants loads reasonably fast
- [ ] Leaderboard calculates quickly even with many participants

---

## Browser Compatibility

Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

---

## Cleanup (Optional)

After testing, you may want to:

1. Delete test campaign
2. Delete test participants
3. Delete test orders
4. Clear test emails from logs

Or keep as demo data for stakeholder review.

---

## Test Completion Sign-off

**Tester Name:** ___________________________

**Date:** ___________________________

**Result:** ⬜ PASS  ⬜ FAIL  ⬜ PARTIAL

**Issues Found:**

_____________________________________________

_____________________________________________

_____________________________________________

**Notes:**

_____________________________________________

_____________________________________________

_____________________________________________
