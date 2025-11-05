# Environment Setup Documentation

This document outlines all environment variables required for the Jose Madrid Salsa admin panel.

## Core Configuration

### Database
```bash
DATABASE_URL="postgres://..."           # PostgreSQL connection string
PRISMA_DATABASE_URL="prisma+postgres://..." # Prisma Accelerate URL (optional)
```

### Authentication
```bash
NEXTAUTH_URL="http://localhost:3000"    # App URL (change for production)
NEXTAUTH_SECRET="your-secret-key-here"  # Strong random string (32+ chars)
```

### Encryption (Admin Panel)
```bash
MASTER_KEY="your-master-encryption-key" # AES-256 master key (64 hex chars)
```
**Generate with**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Payment Processing

### Stripe
```bash
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

## Email Service

### Resend
```bash
RESEND_API_KEY="re_..."
FROM_EMAIL="orders@josemadridsalsa.com"
```

## Customer Experience & Marketing

### Public Site Contact + Reviews
```bash
NEXT_PUBLIC_SUPPORT_EMAIL="mike@josemadrid.net"                 # Footer contact email
NEXT_PUBLIC_SUPPORT_PHONE="(740) 521-4304"                      # Footer phone number (format for tel:)
NEXT_PUBLIC_HQ_LOCATION="601 Putnam Ave, Zanesville, OH 43701"  # Displayed in footer contact block
NEXT_PUBLIC_GOOGLE_BUSINESS_URL="https://g.page/..."            # Review link for navigation/footer
GOOGLE_REVIEW_URL="https://g.page/..."                          # Optional override for checkout review CTA
NEXT_PUBLIC_FACEBOOK_HANDLE="@JoseMadridSalsa"                  # Displayed in social management + forms
NEXT_PUBLIC_INSTAGRAM_HANDLE="@JoseMadridSalsa"
NEXT_PUBLIC_TWITTER_HANDLE="@JoseMadridSalsa"
NEXT_PUBLIC_TIKTOK_HANDLE="@JoseMadridSalsa"
NEXT_PUBLIC_GMB_SHORTNAME="Jose Madrid Salsa"
```

### Merchandise Fulfillment
```bash
NEXT_PUBLIC_FULFILLMENT_PARTNER="SpiceLine Fulfillment"         # Print-on-demand partner name
NEXT_PUBLIC_FULFILLMENT_EMAIL="partner-support@domain.com"      # Mailto used for setup requests
NEXT_PUBLIC_FULFILLMENT_PORTAL_URL="https://portal.partner.com" # External portal for merch management
```

### AI Assistant
```bash
AI_CHAT_PROVIDER="openai"                                      # or "smileyface"
NEXT_PUBLIC_AI_CHAT_PROVIDER="OpenAI"                          # Public-facing provider label
OPENAI_API_KEY="sk-..."                                        # Required when AI_CHAT_PROVIDER=openai
OPENAI_MODEL="gpt-4o-mini"                                     # Optional override
SMILEYFACE_API_KEY="sf-..."                                    # Required when AI_CHAT_PROVIDER=smileyface
SMILEYFACE_API_BASE="https://api.smileyface.ai/v1"             # Optional, defaults to SmileyFace production URL
```

## File Upload

### UploadThing
```bash
UPLOADTHING_SECRET="sk_..."
UPLOADTHING_APP_ID="..."
```

## Google Services

### Google Calendar
```bash
GOOGLE_CALENDAR_ID="your-calendar-id@group.calendar.google.com"
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_IMPERSONATED_USER="user@domain.com"  # Optional
```

### Google OAuth (Optional)
```bash
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### Google Analytics
```bash
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID="G-HG4QV5GFKH"  # Default: G-HG4QV5GFKH (hardcoded as fallback)
```

### Google My Business (Phase 4)
```bash
GOOGLE_MY_BUSINESS_LOCATION_ID="..."
```

## Social Media Integrations (Phase 4)

### Meta (Facebook & Instagram)
```bash
META_APP_ID="..."
META_APP_SECRET="..."
# OAuth tokens stored encrypted in ServiceKey model
```

### X (Twitter)
```bash
X_API_KEY="..."
X_API_SECRET="..."
X_BEARER_TOKEN="..."
# OAuth tokens stored encrypted in ServiceKey model
```

### TikTok
```bash
TIKTOK_CLIENT_KEY="..."
TIKTOK_CLIENT_SECRET="..."
# OAuth tokens stored encrypted in ServiceKey model
```

## Development

```bash
NODE_ENV="development"  # or "production"
```

## Security Notes

1. **NEVER commit `.env` files to version control**
2. **Rotate secrets regularly** (especially NEXTAUTH_SECRET and MASTER_KEY)
3. **Use different keys** for development, staging, and production
4. **Store production secrets** in Vercel environment variables
5. **OAuth tokens** are stored encrypted in the database using MASTER_KEY

## Vercel Setup

Add all environment variables to your Vercel project:

```bash
vercel env add MASTER_KEY
vercel env add NEXTAUTH_SECRET
# ... add all other variables
```

## Local Development Setup

1. Copy `.env.example` to `.env.local`
2. Fill in required values
3. Generate MASTER_KEY: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
4. Run migrations: `npm run db:migrate`
5. Seed permissions: `npm run db:seed`

## Testing Environment Variables

Required for tests:
```bash
DATABASE_URL="postgresql://..."  # Test database
MASTER_KEY="test-key-32-chars-hex"
NEXTAUTH_SECRET="test-secret"
```
