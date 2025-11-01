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
GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"
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
