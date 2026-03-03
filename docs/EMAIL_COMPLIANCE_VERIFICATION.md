# Email Compliance Verification Guide

This guide provides step-by-step instructions for manually verifying that all emails from the Jose Madrid Salsa application comply with email regulations (CAN-SPAM Act) by including proper unsubscribe mechanisms.

## Requirements

All transactional and marketing emails must include:

1. **List-Unsubscribe Header** - Allows email clients to show an automatic "Unsubscribe" button
2. **Unsubscribe Link in Footer** - Visible link in email footer for users to unsubscribe

## Automated Verification

Run the compliance test suite:

```bash
npm test -- verify-compliance
```

This will verify:
- ✅ All emails include List-Unsubscribe header
- ✅ All emails include List-Unsubscribe-Post header (one-click unsubscribe)
- ✅ All emails have "Unsubscribe" link in footer
- ✅ Unsubscribe URL is properly formatted

## Manual Verification

### Step 1: Send Test Emails

Use the test script to send sample emails:

```bash
# From project root
npx tsx tests/email/send-test-emails.ts
```

Or manually trigger via API:

```bash
# Order Confirmation
curl -X POST http://localhost:3000/api/send-email/order-confirmation \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@gmail.com",
    "orderNumber": "TEST-12345",
    "orderDate": "2024-01-15",
    "orderTotal": "$45.00",
    "items": [],
    "shippingAddress": "123 Main St, Austin, TX 78701"
  }'

# Shipping Notification
curl -X POST http://localhost:3000/api/send-email/shipping \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@gmail.com",
    "orderNumber": "TEST-12345",
    "trackingNumber": "USPS123456",
    "trackingUrl": "https://tools.usps.com/go/TrackConfirmAction?tLabels=USPS123456",
    "carrier": "USPS",
    "estimatedDelivery": "Jan 20, 2024",
    "shippingAddress": "123 Main St, Austin, TX 78701",
    "items": []
  }'

# Delivery Confirmation
curl -X POST http://localhost:3000/api/send-email/delivery \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test@gmail.com",
    "orderNumber": "TEST-12345",
    "deliveryDate": "Jan 20, 2024",
    "shippingAddress": "123 Main St, Austin, TX 78701",
    "items": []
  }'

# Contact Form
curl -X POST http://localhost:3000/api/send-email/contact \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "your-test@gmail.com",
    "message": "This is a test message"
  }'
```

### Step 2: Verify List-Unsubscribe Header

#### Gmail

1. Open the test email in Gmail
2. Click the three dots menu (⋮) in top right
3. Select "Show original"
4. Search for "List-Unsubscribe" in the headers
5. Verify you see:
   ```
   List-Unsubscribe: <https://josemadrid.net/unsubscribe?email=...>
   List-Unsubscribe-Post: List-Unsubscribe=One-Click
   ```

#### Outlook

1. Open the test email in Outlook
2. Go to File > Info > Properties
3. Look in the "Internet headers" section
4. Search for "List-Unsubscribe"
5. Verify the header is present

#### Apple Mail

1. Open the test email in Apple Mail
2. View > Message > Raw Source (⌥⌘U)
3. Search for "List-Unsubscribe"
4. Verify the header is present

#### Yahoo Mail

1. Open the test email in Yahoo Mail
2. Click "More" menu (...)
3. Select "View Raw Message"
4. Search for "List-Unsubscribe"
5. Verify the header is present

### Step 3: Verify Unsubscribe Link in Footer

For each test email, scroll to the bottom and verify:

1. ✅ "Unsubscribe" link is visible in the footer
2. ✅ Link is clearly labeled as "Unsubscribe"
3. ✅ Link points to `/unsubscribe?email=...` with the recipient's email
4. ✅ Footer also includes Privacy Policy and Terms of Service links
5. ✅ Company address is displayed (legal requirement)

### Step 4: Test Unsubscribe Functionality

1. Click the "Unsubscribe" link in the email footer
2. Verify you are redirected to the unsubscribe page
3. Verify the email field is pre-populated with your email address
4. Select email categories to unsubscribe from (or all emails)
5. Click "Update Preferences"
6. Verify success message appears
7. Verify preference is saved in database:
   ```sql
   SELECT * FROM unsubscribe_preferences WHERE email = 'your-test@gmail.com';
   ```

### Step 5: Verify One-Click Unsubscribe

Some email clients (Gmail, Yahoo) support one-click unsubscribe:

1. Look for an "Unsubscribe" link/button near the sender's name in Gmail
2. Click it and verify it works
3. This functionality relies on the `List-Unsubscribe-Post` header

## Email Client Support

| Email Client | List-Unsubscribe Header | One-Click Unsubscribe | Footer Link |
|--------------|------------------------|-----------------------|-------------|
| Gmail (Web)  | ✅ Shows unsubscribe button | ✅ Supported | ✅ Required |
| Gmail (Mobile) | ✅ Shows unsubscribe button | ✅ Supported | ✅ Required |
| Outlook (Desktop) | ✅ Shows unsubscribe button | ❌ Not supported | ✅ Required |
| Outlook (Web) | ✅ Shows unsubscribe button | ❌ Not supported | ✅ Required |
| Apple Mail | ✅ Recognized | ❌ Not supported | ✅ Required |
| Yahoo Mail | ✅ Shows unsubscribe button | ✅ Supported | ✅ Required |

## Compliance Checklist

Before deploying to production, verify all items:

### Headers
- [ ] All emails include `List-Unsubscribe` header
- [ ] All emails include `List-Unsubscribe-Post: List-Unsubscribe=One-Click` header
- [ ] Unsubscribe URL is properly formatted: `https://josemadrid.net/unsubscribe?email=...`
- [ ] URL uses HTTPS (required for security)
- [ ] Email address is properly URL-encoded in the unsubscribe link

### Footer
- [ ] All emails display "Unsubscribe" link in footer
- [ ] Link is clearly visible and not hidden in fine print
- [ ] Link color contrasts with background (accessibility)
- [ ] Company physical address is displayed (CAN-SPAM requirement)
- [ ] Footer includes company name: "Jose Madrid Salsa"
- [ ] Footer includes support email: support@josemadridsalsa.com

### Functionality
- [ ] Clicking unsubscribe link redirects to `/unsubscribe` page
- [ ] Email field is pre-populated on unsubscribe page
- [ ] User can select which email types to unsubscribe from
- [ ] User can unsubscribe from all emails
- [ ] Preference is saved to `unsubscribe_preferences` table
- [ ] Unsubscribed users do not receive future emails
- [ ] Transactional emails (order, shipping) are still sent to unsubscribed users

### Testing
- [ ] Automated tests pass: `npm test -- verify-compliance`
- [ ] Manual verification in Gmail complete
- [ ] Manual verification in Outlook complete
- [ ] Manual verification in Apple Mail complete
- [ ] Manual verification in Yahoo Mail complete
- [ ] One-click unsubscribe tested in Gmail
- [ ] Database unsubscribe preferences tested

## Troubleshooting

### List-Unsubscribe header not showing

**Problem**: Email clients don't show the unsubscribe button

**Solutions**:
1. Verify header is present by viewing raw email source
2. Check that URL uses HTTPS (not HTTP)
3. Ensure email is not flagged as spam
4. Some clients only show unsubscribe for bulk emails (send multiple test emails)
5. Check that `List-Unsubscribe-Post` header is also present

### Unsubscribe link not working

**Problem**: Clicking unsubscribe returns 404 or error

**Solutions**:
1. Verify `/unsubscribe` page exists: `app/unsubscribe/page.tsx`
2. Check that `NEXT_PUBLIC_BASE_URL` environment variable is set correctly
3. Verify email address is properly URL-encoded
4. Check server logs for errors
5. Test the unsubscribe page directly: `http://localhost:3000/unsubscribe?email=test@example.com`

### Preferences not saving

**Problem**: Unsubscribe preferences not persisted to database

**Solutions**:
1. Verify database migration ran: `npx prisma migrate status`
2. Check that `unsubscribe_preferences` table exists
3. Verify API route at `/api/unsubscribe` is working
4. Check browser console for errors
5. Test API directly:
   ```bash
   curl -X POST http://localhost:3000/api/unsubscribe \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "unsubscribeAll": true}'
   ```

## Legal Requirements (CAN-SPAM Act)

All commercial emails must include:

1. ✅ **Unsubscribe mechanism** - Clear, conspicuous opt-out method
2. ✅ **Physical address** - Valid physical postal address
3. ✅ **Accurate header info** - From, To, Reply-To must be accurate
4. ✅ **Honest subject lines** - Subject must reflect content
5. ✅ **Honor opt-outs promptly** - Process within 10 business days
6. ✅ **Don't charge fees** - Unsubscribe must be free
7. ✅ **Monitor third parties** - If using email service, ensure compliance

Our implementation:
- ✅ Unsubscribe link in all emails
- ✅ Physical address in footer: "123 Main Street, Austin, TX 78701"
- ✅ Accurate sender: orders@josemadridsalsa.com
- ✅ Accurate subject lines in all templates
- ✅ Preferences saved immediately to database
- ✅ Free unsubscribe (no account required)
- ✅ Using Resend (compliant email service provider)

## Additional Resources

- [CAN-SPAM Act Compliance Guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
- [RFC 8058: List-Unsubscribe Header](https://datatracker.ietf.org/doc/html/rfc8058)
- [Resend Email Best Practices](https://resend.com/docs/knowledge-base/email-best-practices)
- [Gmail Unsubscribe Guidelines](https://support.google.com/mail/answer/81126)

## Support

If you encounter issues with email compliance:

1. Check automated tests: `npm test -- verify-compliance`
2. Review this documentation
3. Check Resend dashboard for delivery issues
4. Contact: mike@josemadrid.net
