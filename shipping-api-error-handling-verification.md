# Shipping API Error Handling - Manual Verification Guide

This document provides step-by-step instructions for manually verifying that the checkout flow gracefully handles shipping API failures and never blocks checkout.

## Critical Requirement

**Checkout MUST complete successfully even when the shipping API is unavailable or returns errors.**

## Prerequisites

1. Development server running: `npm run dev`
2. At least one active product in the database
3. Access to environment variables (`.env.local`)

## Test Scenarios

### Scenario 1: Missing API Key (API Unavailable)

**Purpose:** Verify checkout works when shipping API credentials are not configured.

**Steps:**

1. **Disable Shipping API:**
   ```bash
   # In .env.local, comment out or remove SHIPPING_API_KEY
   # SHIPPING_API_KEY=your_key_here
   ```

2. **Restart Development Server:**
   ```bash
   # Press Ctrl+C to stop
   npm run dev
   ```

3. **Test Checkout Flow:**
   - Navigate to http://localhost:3000
   - Add a product to cart
   - Go to checkout: http://localhost:3000/checkout
   - Fill in shipping address:
     ```
     Address: 123 Main Street
     City: San Francisco
     State: CA
     Zip: 94111
     Country: US
     ```
   - Observe: Shipping options should appear (estimate rates)
   - Verify: Shipping cost is reasonable ($6.99 - $15 range for CA)
   - Verify: Multiple shipping options are available

4. **Expected Results:**
   - ✅ Shipping calculation succeeds (returns 200 status)
   - ✅ Estimate rates are displayed
   - ✅ Response includes `"fallback": true` flag
   - ✅ At least 2 shipping options available
   - ✅ Checkout page displays shipping options
   - ✅ User can select a shipping option
   - ✅ Total updates correctly

5. **Check Console Logs:**
   Look for these messages in server console:
   ```
   [Shipping API] Error fetching rates: ...
   [Shipping Calculator] Falling back to estimate-based rates
   ```

6. **Restore Configuration:**
   ```bash
   # Uncomment SHIPPING_API_KEY in .env.local
   SHIPPING_API_KEY=your_key_here
   ```

---

### Scenario 2: Invalid API Key (Authentication Failure)

**Purpose:** Verify checkout works when API key is invalid or expired.

**Steps:**

1. **Set Invalid API Key:**
   ```bash
   # In .env.local, set an invalid key
   SHIPPING_API_KEY=invalid_test_key_12345
   ```

2. **Restart Development Server:**
   ```bash
   npm run dev
   ```

3. **Test Checkout Flow:**
   - Add product to cart
   - Go to checkout
   - Enter shipping address (same as above)
   - Observe shipping options

4. **Expected Results:**
   - ✅ Shipping calculation succeeds
   - ✅ Estimate rates are returned
   - ✅ Checkout is not blocked
   - ✅ Console shows authentication error log

5. **Restore Configuration:**
   ```bash
   # Set valid API key in .env.local
   SHIPPING_API_KEY=your_valid_key_here
   ```

---

### Scenario 3: Test Different Address Types with Fallback

**Purpose:** Verify fallback rates work correctly for different address scenarios.

**With API unavailable (no SHIPPING_API_KEY), test these addresses:**

#### 3a. Alaska Address (Surcharge)
```
Address: 123 Arctic Ave
City: Anchorage
State: AK
Zip: 99501
```
**Expected:** Shipping cost higher than CA (1.5x multiplier ~$10.50)

#### 3b. Hawaii Address (Surcharge)
```
Address: 456 Beach Road
City: Honolulu
State: HI
Zip: 96815
```
**Expected:** Shipping cost higher than CA (1.5x multiplier ~$10.50)

#### 3c. PO Box Address
```
Address: PO Box 12345
City: Seattle
State: WA
Zip: 98101
```
**Expected:** Only USPS shipping options (no UPS/FedEx)

#### 3d. International Address (Canada)
```
Address: 123 Main Street
City: Toronto
State: ON
Zip: M5H 2N2
Country: CA
```
**Expected:** International shipping rate (~$24.99), longer delivery time

---

### Scenario 4: Free Shipping Threshold

**Purpose:** Verify free shipping works with fallback rates.

**Steps:**

1. **Disable API Key** (to force fallback mode)

2. **Add Products Exceeding $50:**
   - Add enough products to cart to exceed $50 subtotal
   - Go to checkout
   - Enter any US address

3. **Expected Results:**
   - ✅ Shipping cost = $0.00
   - ✅ Shipping method = "Free Shipping"
   - ✅ Free shipping badge/message displayed
   - ✅ Total = subtotal only (no shipping charge)

---

### Scenario 5: Complete Checkout with Fallback Rates

**Purpose:** Verify full checkout flow completes successfully with estimate rates.

**Steps:**

1. **Disable API Key** (to force fallback mode)

2. **Complete Full Checkout:**
   - Add product to cart
   - Go to checkout
   - Fill in all required fields:
     - Email
     - Shipping address
     - Billing address (or same as shipping)
   - Select a shipping option
   - Verify total is correct
   - Enter test credit card (Stripe test mode):
     ```
     Card: 4242 4242 4242 4242
     Exp: Any future date
     CVC: Any 3 digits
     Zip: Any 5 digits
     ```
   - Click "Place Order"

3. **Expected Results:**
   - ✅ Order is created successfully
   - ✅ Shipping cost is saved to order
   - ✅ Shipping method is saved to order
   - ✅ Order confirmation page displays
   - ✅ No errors or crashes
   - ✅ Database contains order with shipping details

---

## Automated Tests

Run the automated test suite:

```bash
npm test -- tests/e2e/shipping-api-error-handling.test.ts
```

**Expected Results:**
- All 8 test scenarios pass
- No test failures or errors
- Tests verify:
  - Missing API key handling
  - Invalid API key handling
  - Estimate rates quality
  - Free shipping threshold
  - PO Box handling
  - International shipping
  - Checkout completion
  - Error recovery

---

## Success Criteria

✅ **All scenarios must pass these checks:**

1. **No 500 Errors:** Shipping API failures never return HTTP 500
2. **Always Returns Rates:** Response always includes shippingCost and availableOptions
3. **Fallback Flag Set:** Response includes `"fallback": true` when using estimates
4. **Checkout Not Blocked:** User can complete checkout with estimate rates
5. **Reasonable Rates:** Estimate rates are in expected range ($0-$30 for domestic)
6. **State Surcharges Applied:** AK/HI show higher rates (1.5x)
7. **Free Shipping Works:** Orders over $50 show $0 shipping
8. **PO Box Filtering:** PO Box addresses only show USPS options
9. **International Supported:** Non-US addresses get international rate
10. **Logging Present:** Server logs show fallback warnings

---

## Troubleshooting

### Issue: No shipping options displayed

**Check:**
- Are products in database with prices?
- Is calculateShipping function being called?
- Check browser console for errors

### Issue: Checkout fails with error

**Check:**
- Are all required fields filled?
- Is Stripe configured correctly?
- Check server logs for error details

### Issue: Fallback flag not set

**Check:**
- Did you restart dev server after changing .env?
- Is API key truly missing/invalid?
- Check response in Network tab

---

## Cleanup

After testing, restore your environment:

1. **Restore API Key:**
   ```bash
   # In .env.local
   SHIPPING_API_KEY=your_valid_key_here
   ```

2. **Restart Server:**
   ```bash
   npm run dev
   ```

3. **Verify Normal Operation:**
   - Test one checkout with valid API key
   - Verify real carrier rates are returned
   - Verify `"fallback": false` in response

---

## Related Files

- `/lib/shipping-calculator.ts` - Main shipping logic with fallback
- `/lib/shipping-api.ts` - API client with error handling
- `/app/api/checkout/calculate-shipping/route.ts` - API endpoint
- `/tests/e2e/shipping-api-error-handling.test.ts` - Automated tests

---

## Notes

- **Critical:** Never let shipping API failures block checkout
- Estimate rates are acceptable fallback for MVP
- Production should monitor fallback frequency
- Consider alerts when fallback rate exceeds threshold (e.g., >10% of requests)
