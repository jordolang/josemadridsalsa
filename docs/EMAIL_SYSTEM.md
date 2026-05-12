# Email System Documentation

## Overview

The Jose Madrid Salsa email system is built on top of Resend and React Email, providing a robust email delivery infrastructure with logging, unsubscribe management, and rate limiting. The system supports both transactional and marketing emails with comprehensive tracking and compliance features.

## Architecture

### Core Components

#### 1. Email Client (`lib/email/client.ts`)
The central email client that handles all email sending operations.

**Key Features:**
- React Email template rendering
- Unsubscribe preference checking
- Email send logging
- Automatic List-Unsubscribe header injection for compliance
- Email hashing for privacy in logs
- Transactional vs. marketing email differentiation

**Main Function:**
```typescript
sendEmail({
  to: string | string[]
  subject: string
  react: React.ReactElement
  from?: string
  replyTo?: string
  type: string
  orderId?: string
  userId?: string
}): Promise<EmailSendResult>
```

**Transactional Email Types** (always sent, bypass unsubscribe):
- `order-confirmation`
- `shipping-notification`
- `delivery-confirmation`

#### 2. Email Automation (`lib/email/automation.ts`)
Pre-built email automation functions for common use cases. Each function fetches necessary data and composes the appropriate email template.

**Available Functions:**
- `sendWelcomeEmail()` - New user welcome with discount code
- `sendOrderConfirmationEmail()` - Order confirmation with items and tracking
- `sendFundraiserDonationReceipt()` - Donation receipt for fundraiser contributions
- `sendNewsletterWelcomeEmail()` - Newsletter subscription confirmation
- `sendContactConfirmationEmail()` - Contact form submission confirmation
- `sendFundraiserFollowupEmail()` - Fundraiser inquiry followup
- `sendCampaignLaunchEmail()` - Fundraising campaign launch notification
- `sendAbandonedCartEmail()` - Cart recovery with discount code
- `sendParticipantWelcomeEmail()` - Fundraiser participant onboarding
- `sendParticipantMilestoneEmail()` - Participant sales milestone celebration
- `sendCampaignSummaryEmail()` - End-of-campaign summary report

#### 3. Email Logger (`lib/email/logger.ts`)
Manages email logging and unsubscribe preferences using Prisma.

**Key Functions:**
- `logEmailSend()` - Log email send attempts with status tracking
- `updateEmailLog()` - Update logs with opens, clicks, bounces
- `checkUnsubscribed()` - Verify user unsubscribe preferences
- `unsubscribeFromCategory()` - Add category-specific unsubscribe
- `unsubscribeFromAll()` - Global unsubscribe
- `resubscribeToCategory()` - Re-enable specific categories
- `getEmailStats()` - Recipient email statistics
- `getRecentEmailLogs()` - Recent email history for user

**Unsubscribe Categories:**
Marketing categories (fail-closed on DB error):
- `marketing`
- `newsletter`
- `promotions`
- `announcements`

#### 4. Rate Limiter (`lib/email/rate-limit.ts`)
In-memory rate limiting for email API endpoints.

**Key Functions:**
- `checkRateLimit()` - IP-based rate limiting with configurable windows
- `validateServiceApiKey()` - Internal service authentication

## Email Types

### 1. Welcome Email
**Type:** `welcome`  
**Trigger:** New user registration  
**Template:** Inline EmailLayout  
**Features:**
- Personalized greeting
- Discount code (default: WELCOME15)
- Brand introduction

### 2. Order Confirmation
**Type:** `order-confirmation`  
**Trigger:** Order placement  
**Template:** `OrderConfirmationEmail`  
**Features:**
- Order number and date
- Line items with pricing
- Shipping/fulfillment info
- Tracking link
- Updates order with `confirmationEmailSentAt` timestamp

### 3. Fundraiser Donation Receipt
**Type:** `fundraiser-donation-receipt`  
**Trigger:** Fundraiser donation  
**Template:** `FundraiserDonationReceipt`  
**Features:**
- Donation amount
- Team/organization details
- Receipt ID for records
- Optional donor message
- Link to team page

### 4. Newsletter Welcome
**Type:** `newsletter-welcome`  
**Trigger:** Newsletter subscription  
**Template:** Inline EmailLayout  
**Features:**
- Subscription confirmation
- Content preview
- Unsubscribe options

### 5. Contact Confirmation
**Type:** `contact-confirmation`  
**Trigger:** Contact form submission  
**Template:** Inline EmailLayout  
**Features:**
- Submission acknowledgment
- Follow-up timeline
- Support contact info

### 6. Fundraiser Followup
**Type:** `fundraiser-followup`  
**Trigger:** Fundraiser inquiry submission  
**Template:** Inline EmailLayout  
**Features:**
- Organization-specific details
- Goal information
- Next steps
- Support contact

### 7. Campaign Launch
**Type:** `campaign-launch`  
**Trigger:** Fundraiser campaign activation  
**Template:** `CampaignLaunchEmail`  
**Features:**
- Campaign dates and goals
- Coordinator instructions
- Campaign URL
- Support resources

### 8. Abandoned Cart
**Type:** `abandoned-cart`  
**Trigger:** Cart inactive for specified duration  
**Template:** Inline EmailLayout  
**Features:**
- Cart contents preview
- Recovery discount code (COMEBACK10)
- Direct checkout link with recovery token

### 9. Participant Welcome
**Type:** `participant-welcome`  
**Trigger:** Fundraiser participant joins  
**Template:** `ParticipantWelcomeEmail`  
**Features:**
- Referral code for tracking
- Fundraiser details
- Getting started guide

### 10. Participant Milestone
**Type:** `participant-milestone`  
**Trigger:** Sales milestone reached  
**Template:** `ParticipantMilestoneEmail`  
**Features:**
- Milestone celebration
- Total sales and amount raised
- Dashboard link
- Encouragement message

### 11. Campaign Summary
**Type:** `campaign-summary`  
**Trigger:** Campaign end or scheduled report  
**Template:** `CampaignSummaryEmail`  
**Features:**
- Total orders and revenue
- Amount raised calculation
- Top 5 participants
- Campaign performance metrics

## API Endpoints

### POST /api/send-email/contact
Send contact form submission emails to company.

**Authentication:** None (rate limited by IP)  
**Rate Limit:** 5 requests per 60 seconds per IP

**Request Body:**
```typescript
{
  name: string          // Required, max 200 chars
  email: string         // Required, valid email, max 320 chars
  phone?: string        // Optional, max 30 chars
  message: string       // Required, max 5000 chars
  submittedAt?: string  // Optional ISO timestamp
  userId?: string       // Optional user ID
  unsubscribeUrl?: string // Optional unsubscribe URL
}
```

**Response:**
```typescript
{
  success: boolean
  messageId?: string
  from: string
}
```

### POST /api/send-email/shipping
Send shipping notification emails.

**Authentication:** Required (SERVICE_API_KEY via x-api-key header)  
**Rate Limit:** 30 requests per 60 seconds per IP

**Request Body:**
```typescript
{
  email: string             // Required
  name?: string
  orderNumber: string       // Required
  trackingNumber: string    // Required
  trackingUrl: string       // Required, valid URL
  carrier: string           // Required
  estimatedDelivery: string // Required
  shippingAddress: string   // Required
  items?: OrderItem[]
  orderId?: string
  userId?: string
  unsubscribeUrl?: string
}
```

**OrderItem:**
```typescript
{
  quantity: number
  productName: string
  productSku: string
  totalPrice: number | string
}
```

**Response:**
```typescript
{
  success: boolean
  messageId?: string
  orderNumber: string
}
```

### POST /api/send-email/delivery
Send delivery confirmation emails.

**Authentication:** Required (SERVICE_API_KEY via x-api-key header)  
**Rate Limit:** 30 requests per 60 seconds per IP

**Request Body:**
```typescript
{
  email: string           // Required
  name?: string
  orderNumber: string     // Required
  deliveryDate: string    // Required
  shippingAddress: string // Required
  items?: OrderItem[]
  feedbackUrl?: string
  orderDetailsUrl?: string
  orderId?: string
  userId?: string
  unsubscribeUrl?: string
}
```

**Response:**
```typescript
{
  success: boolean
  messageId?: string
  orderNumber: string
}
```

## Environment Variables

### Required

**RESEND_API_KEY**  
Resend API key for email delivery. System will fail gracefully if missing.

### Optional

**FROM_EMAIL**  
Default sender email address.  
Default: `Jose Madrid Salsa <mike@josemadrid.net>`

**NEXT_PUBLIC_BASE_URL**  
Base URL for unsubscribe links and web content.  
Default: `https://josemadrid.net`

**NEXT_PUBLIC_APP_URL**  
Application URL for links in emails.  
Default: Uses NEXTAUTH_URL or `https://www.josemadridsalsa.com`

**NEXTAUTH_URL**  
Fallback URL for app links.

**SERVICE_API_KEY**  
Internal service authentication key for protected endpoints (shipping, delivery).  
Required for `/api/send-email/shipping` and `/api/send-email/delivery`.

## Integration Points

### React Email Templates

All email templates use React Email components for consistent styling and maintainability.

**Core Components:**
- `EmailLayout` - Base layout wrapper with preview text
- `EmailHeader` - Brand header with logo
- `EmailFooter` - Footer with unsubscribe link
- `Button` - Styled CTA buttons

**Template Locations:**
- `emails/*.tsx` - Pre-built templates (order confirmation, shipping, delivery, etc.)
- `lib/email/templates/*.tsx` - Campaign-specific templates

### Prisma Database

**EmailLog Model:**
Tracks all email send attempts with status, opens, clicks, bounces.

**UnsubscribePreference Model:**
Manages user unsubscribe preferences by category and global opt-out.

**Fields:**
- `email` - Recipient email (unique)
- `userId` - Optional linked user
- `unsubscribeAll` - Global opt-out flag
- `unsubscribedFrom` - Array of category strings

### Resend Integration

**Provider:** Resend (https://resend.com)

**Features Used:**
- Email sending API
- List-Unsubscribe header support
- Reply-to configuration
- HTML email rendering

**Headers Set:**
- `List-Unsubscribe: <unsubscribe-url>`
- `List-Unsubscribe-Post: List-Unsubscribe=One-Click`

### Compliance Features

#### Unsubscribe Management
- One-click unsubscribe URLs in all emails
- Category-based unsubscribe (marketing vs. transactional)
- Transactional emails always sent regardless of preferences
- Fail-closed approach: If DB error on marketing check, email not sent

#### Privacy
- Email addresses hashed in logs (SHA-256, 12 chars)
- No PII in console logs beyond hashed identifiers

#### Rate Limiting
- IP-based rate limiting prevents abuse
- Different limits for public vs. service endpoints
- Retry-After headers on 429 responses

## Usage Examples

### Sending a Welcome Email

```typescript
import { sendWelcomeEmail } from '@/lib/email/automation'

await sendWelcomeEmail({
  email: 'customer@example.com',
  name: 'John Doe',
  discountCode: 'WELCOME15'
})
```

### Sending an Order Confirmation

```typescript
import { sendOrderConfirmationEmail } from '@/lib/email/automation'

// Automatically fetches order data from database
await sendOrderConfirmationEmail('order-id-here')
```

### Custom Email with sendEmail

```typescript
import { sendEmail } from '@/lib/email/client'
import React from 'react'
import { EmailLayout } from '@/emails/components/EmailLayout'

const emailContent = React.createElement(
  EmailLayout,
  { previewText: 'Custom Email' },
  // ... your email content
)

await sendEmail({
  to: 'customer@example.com',
  subject: 'Custom Subject',
  react: emailContent,
  type: 'custom-type',
  userId: 'user-id'
})
```

### Checking Unsubscribe Status

```typescript
import { checkUnsubscribed } from '@/lib/email/logger'

const isUnsubscribed = await checkUnsubscribed({
  email: 'customer@example.com',
  category: 'newsletter'
})

if (!isUnsubscribed) {
  // Send email
}
```

### Calling Protected API Endpoints

```typescript
// Shipping notification
const response = await fetch('/api/send-email/shipping', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.SERVICE_API_KEY
  },
  body: JSON.stringify({
    email: 'customer@example.com',
    name: 'John Doe',
    orderNumber: 'ORD-12345',
    trackingNumber: '1Z999AA10123456784',
    trackingUrl: 'https://track.example.com/1Z999AA10123456784',
    carrier: 'UPS',
    estimatedDelivery: 'May 15, 2026',
    shippingAddress: '123 Main St, Austin, TX 78701',
    items: [
      {
        quantity: 2,
        productName: 'Habanero Salsa',
        productSku: 'SAL-HAB-001',
        totalPrice: 19.98
      }
    ]
  })
})
```

## Error Handling

### Client Errors (sendEmail function)

The `sendEmail` function returns a structured result:

```typescript
interface EmailSendResult {
  success: boolean
  error?: string
  messageId?: string
  data?: any
}
```

**Common Error Cases:**
- `RESEND_API_KEY missing` - Environment not configured
- `User unsubscribed` - Recipient has opted out
- Resend API errors - Delivery failures

All errors are logged to database via `logEmailSend()` with status `FAILED`.

### API Endpoint Errors

**400 Bad Request** - Validation error (invalid email, missing required fields)  
**401 Unauthorized** - Missing or invalid SERVICE_API_KEY  
**429 Too Many Requests** - Rate limit exceeded (includes Retry-After header)  
**500 Internal Server Error** - Unexpected server error

## Monitoring and Analytics

### Email Logs

All email sends are logged to the `EmailLog` table with:
- Recipient email (for querying, never displayed)
- User ID (if authenticated)
- Template ID (email type)
- Subject line
- Status (PENDING, SENT, FAILED, BOUNCED)
- Timestamps (sent, opened, clicked, bounced, failed)
- Error message (if failed)
- Metadata (order ID, campaign ID, etc.)

### Statistics

Query email statistics using `getEmailStats()`:
- Total sent
- Total opened / click-through rate
- Open rate / click rate percentages
- Last email sent date
- Status breakdown

### Webhooks

The system is designed to receive webhook events from Resend for:
- Delivery confirmations
- Opens
- Clicks
- Bounces
- Complaints

**Webhook Endpoint:** `/api/webhooks/resend`

## Best Practices

### When to Use Automation Functions vs. sendEmail

**Use automation functions** when:
- Sending standard emails with established templates
- Email requires data fetching from database
- Email should update related records (e.g., order confirmation timestamp)

**Use sendEmail directly** when:
- Creating one-off custom emails
- Building new email types
- Prototyping new templates

### Transactional vs. Marketing Classification

**Transactional** (always sent):
- Order confirmations
- Shipping notifications
- Delivery confirmations
- Password resets
- Account security alerts

**Marketing** (respects unsubscribe):
- Welcome emails
- Newsletter emails
- Abandoned cart emails
- Promotional campaigns

### Template Development

1. Build templates in `emails/` directory using React Email
2. Use shared components (EmailLayout, EmailHeader, EmailFooter)
3. Test with `renderEmailTemplate()` before deploying
4. Include unsubscribe URL in footer
5. Use inline styles for email client compatibility

### Performance Optimization

- Rate limit external API calls to prevent abuse
- Use in-memory cache for rate limiting (auto-cleanup)
- Log email sends asynchronously (don't block on log failures)
- Hash emails in logs for privacy and efficient indexing

## Troubleshooting

### Emails Not Sending

1. Check `RESEND_API_KEY` is set in environment
2. Verify email type is not transactional or recipient hasn't unsubscribed
3. Check Resend dashboard for delivery errors
4. Review EmailLog table for failure messages

### Rate Limiting Issues

1. Verify requests are not coming from same IP in burst
2. Adjust rate limits in endpoint if needed for legitimate traffic
3. Consider implementing user-based rate limiting instead of IP-based

### Unsubscribe Not Working

1. Verify `UnsubscribePreference` record exists for email
2. Check `unsubscribeAll` flag vs. category-specific unsubscribe
3. Ensure email type is not transactional (transactional emails bypass unsubscribe)

### Template Rendering Issues

1. Verify React Email syntax is correct
2. Check for missing props in template components
3. Test template rendering with `renderEmailTemplate()`
4. Ensure inline styles are used (no external CSS)

## Future Enhancements

Potential areas for system expansion:
- Advanced segmentation and personalization
- A/B testing for email templates
- Scheduled email campaigns
- Email template visual editor
- Enhanced analytics dashboard
- Multi-language support
- SMS fallback for critical notifications
