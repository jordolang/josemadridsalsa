# Email Testing Documentation

## Overview

This directory contains comprehensive testing materials for the email notification system, including unit tests, integration tests, and manual testing guides.

## Contents

### Automated Tests

- **`order-confirmation.test.tsx`** - Unit tests for order confirmation email template
- **`shipping-notification.test.tsx`** - Unit tests for shipping notification email template
- **`delivery-confirmation.test.tsx`** - Unit tests for delivery confirmation email template
- **`contact-form.test.tsx`** - Unit tests for contact form email template
- **`../api/send-email.test.ts`** - Integration tests for email sending API routes

Run automated tests:
```bash
npm test -- emails
npm test -- send-email
```

### Manual Testing Materials

- **`manual-testing-guide.md`** - Comprehensive guide for testing emails across different email clients (Gmail, Outlook, Apple Mail, Yahoo)
- **`send-test-emails.ts`** - Script to send test emails to real email addresses for manual verification
- **`test-results-template.md`** - Template for documenting manual test results

## Manual Testing Process

### Prerequisites

1. Access to test email accounts on:
   - Gmail (web and mobile)
   - Outlook (web and desktop)
   - Apple Mail (macOS/iOS)
   - Yahoo Mail
2. Development environment running (`npm run dev`)
3. Valid `RESEND_API_KEY` configured in environment

### Step 1: Send Test Emails

Use the test script to send emails to your test accounts:

```bash
# Send all test emails to one address
npx tsx tests/email/send-test-emails.ts --to your-email@gmail.com --all

# Or send specific email types
npx tsx tests/email/send-test-emails.ts --to your-email@gmail.com --type order-confirmation
npx tsx tests/email/send-test-emails.ts --to your-email@outlook.com --type shipping-notification
```

### Step 2: Test in Email Clients

Follow the checklist in `manual-testing-guide.md` to verify:

1. **Deliverability** - Email arrives in inbox (not spam)
2. **Layout** - Template renders correctly
3. **Images** - All images load properly
4. **Links** - All buttons and links work
5. **Mobile** - Responsive design works on mobile devices
6. **Compliance** - Unsubscribe links and headers present

### Step 3: Document Results

Use `test-results-template.md` to record your findings:

```bash
# Copy template to create results file
cp tests/email/test-results-template.md tests/email/test-results-[DATE].md
```

Fill in the checklist as you test each email client.

### Step 4: Review and Fix Issues

- Address any critical issues found
- Make improvements based on feedback
- Retest affected email clients
- Document final results

## Email Client Testing Matrix

| Email Client | Test Priority | Notes |
|--------------|---------------|-------|
| Gmail Web | High | Most common email client |
| Gmail Mobile | High | Test on iOS and Android |
| Outlook Web | Medium | Important for business users |
| Outlook Desktop | Medium | Test Windows version |
| Apple Mail (macOS) | Medium | Common among Mac users |
| Apple Mail (iOS) | High | Mobile testing critical |
| Yahoo Mail | Low | Lower market share but still relevant |

## Common Testing Scenarios

### Scenario 1: First-Time Order Customer
- Send order confirmation email
- Verify all order details display correctly
- Check tracking link works
- Verify support email link opens properly

### Scenario 2: Shipping Update
- Send shipping notification email
- Verify tracking number and carrier info
- Check tracking URL redirects correctly
- Verify estimated delivery date formats properly

### Scenario 3: Delivery Follow-Up
- Send delivery confirmation email
- Verify feedback request is prominent
- Check review link works
- Verify order details link is accessible

### Scenario 4: Customer Support
- Send contact form email
- Verify customer info displays
- Check reply-to email works
- Verify message formatting is preserved

## Troubleshooting

### Emails Going to Spam

**Possible Causes:**
- SPF/DKIM records not configured
- Domain not verified in Resend
- Spam trigger words in content
- Missing physical address in footer

**Solutions:**
- Verify DNS records (see `docs/EMAIL_DNS_SETUP.md`)
- Check Resend dashboard for domain verification
- Test with https://www.mail-tester.com
- Review email content for spam triggers

### Images Not Loading

**Possible Causes:**
- Image URLs are relative, not absolute
- Images not served over HTTPS
- Image file sizes too large
- Email client blocking images by default

**Solutions:**
- Ensure all image URLs are absolute (https://)
- Optimize images (< 100KB recommended)
- Add alt text for accessibility
- Test with images enabled and disabled

### Layout Breaks in Outlook

**Possible Causes:**
- Using CSS that Outlook doesn't support (flexbox, grid)
- Missing table-based layout structure
- No MSO conditional comments

**Solutions:**
- Use table-based layouts for email
- Add MSO-specific styles for Outlook
- Test in Outlook Web and Desktop
- Reference: https://www.caniemail.com

### Mobile Responsiveness Issues

**Possible Causes:**
- Email too wide (> 600px)
- Touch targets too small (< 44px)
- Text too small on mobile

**Solutions:**
- Set max-width: 600px for containers
- Make buttons at least 44x44px
- Use 14px+ font size for body text
- Add mobile-specific media queries

## Verification Checklist

Before marking manual testing as complete, ensure:

- [ ] All 4 email templates tested in 7 email client configurations (28 tests)
- [ ] No emails delivered to spam folder
- [ ] All images load correctly
- [ ] All links work properly
- [ ] Unsubscribe link present in all emails
- [ ] List-Unsubscribe header verified in raw source
- [ ] Mobile responsive design tested on iOS and Android
- [ ] No layout breaks or rendering issues
- [ ] Accessibility checks pass (images off, good contrast)
- [ ] Test results documented in test-results-[DATE].md
- [ ] Screenshots saved for each email client
- [ ] Resend dashboard shows "Delivered" status
- [ ] Critical issues addressed or documented

## Resources

- **React Email Documentation:** https://react.email/docs
- **Email Client CSS Support:** https://www.caniemail.com
- **Mail Tester (Spam Score):** https://www.mail-tester.com
- **Resend Dashboard:** https://resend.com/emails
- **Litmus (Paid Testing Service):** https://litmus.com
- **Email on Acid (Paid Testing Service):** https://www.emailonacid.com

## Support

For questions or issues with email testing:

1. Check `manual-testing-guide.md` for detailed instructions
2. Review automated test results for template issues
3. Consult Resend dashboard for delivery issues
4. Reference React Email docs for component questions

## Next Steps After Manual Testing

Once manual testing is complete:

1. Update `implementation_plan.json` with results
2. Address any issues found during testing
3. Proceed to E2E testing (subtask-6-4)
4. Complete DNS configuration and compliance (Phase 7)
5. Final QA sign-off

## Notes

- Save all test result files with dates for future reference
- Document any client-specific quirks or workarounds
- Test with both images enabled and disabled
- Check dark mode rendering where supported
- Keep screenshots for documentation purposes
