# Environment Variables

This document lists all required and optional environment variables for the Jose Madrid Admin Panel.

## Required Variables

### Database
- `DATABASE_URL` - PostgreSQL connection string
  - Example: `postgresql://user:password@localhost:5432/josemadridsalsa`

### Authentication
- `NEXTAUTH_URL` - Application URL
  - Development: `http://localhost:3000`
  - Production: `https://www.josemadrid.net`
- `NEXTAUTH_SECRET` - Secret for NextAuth.js (generate with `openssl rand -base64 32`)
- `MASTER_KEY` - 64-character hex encryption key for encrypted service and OAuth tokens

## Social Commerce Integrations

### Meta (Facebook / Instagram)
- `FACEBOOK_APP_ID` - Meta app ID used for Facebook Page and Instagram Business OAuth
- `FACEBOOK_APP_SECRET` - Meta app secret used for OAuth code exchange

Required app capabilities and permissions for production use:
- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`
- `pages_manage_metadata`
- `catalog_management`
- `business_management`
- `instagram_basic`
- `instagram_content_publish`
- `instagram_manage_insights`

Notes:
- The admin panel can connect Facebook Pages through OAuth and create Commerce catalogs when the connected account also has the needed Meta Business Manager access.
- Shop review / storefront activation may still require manual approval in Meta Commerce Manager.

### TikTok
- `TIKTOK_CLIENT_KEY` - TikTok developer client key for OAuth
- `TIKTOK_CLIENT_SECRET` - TikTok developer client secret for OAuth

Notes:
- TikTok account OAuth and product export are supported after Seller Center approval.
- TikTok Shop creation / seller onboarding is not a public OAuth flow and must be completed in TikTok Seller Center before product export can succeed.

## Google Integration

### OAuth & Calendar
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret  
- `GOOGLE_CALENDAR_ID` - Calendar ID for event synchronization (usually "primary")

### Maps & Places
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` - Google Maps API key (public)
- `GOOGLE_PLACES_API_KEY` - Google Places API key (server-side)
- `GOOGLE_PLACE_ID` - Google Place ID for Jose Madrid Salsa

### Service Account
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
- `GOOGLE_SERVICE_ACCOUNT_NAME` - Service account name
- `GOOGLE_SERVICE_ACCOUNT_ID` - Service account ID

### Search Console
- `GOOGLE_SEARCH_CONSOLE_PROPERTY` - Search Console property URL

## Payment Processing

### Stripe
- `STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret

## Email

### Resend
- `RESEND_API_KEY` - Resend API key for email delivery
- `FROM_EMAIL` - Default sender email address
- `RESEND_WEBHOOK_SECRET` - Webhook signing secret for verifying Resend webhook payloads (svix-based)

### Email System
- `CRON_SECRET` - Bearer token for authenticating Vercel cron job requests to `/api/cron/*`
- `UNSUBSCRIBE_SECRET` - Secret for signing unsubscribe preference tokens

## Shipping Integrations

### Shopify
- `SHOPIFY_SHOP_DOMAIN` - Shopify shop domain
- `SHOPIFY_API_KEY` - Shopify API key
- `SHOPIFY_API_SECRET` - Shopify API secret
- `SHOPIFY_ACCESS_TOKEN` - Shopify access token
- `SHOPIFY_WEBHOOK_SECRET` - Shopify webhook secret

### ShipStation (Optional)
- `SHIPSTATION_API_KEY` - ShipStation API key
- `SHIPSTATION_API_SECRET` - ShipStation API secret

### Shippo (Optional)
- `SHIPPO_API_KEY` - Shippo API token

### USPS (Optional)
- `USPS_USER_ID` - USPS API user ID

## Analytics

### Google Analytics
- `GOOGLE_ANALYTICS_ID` - Google Analytics measurement ID (e.g., G-XXXXXXXXXX)

## Optional

### File Upload
- `UPLOADTHING_SECRET` - UploadThing secret
- `UPLOADTHING_APP_ID` - UploadThing app ID

## Development vs Production

For development, copy `.env.example` to `.env.local` and fill in the values.
For production, set these in your hosting platform (e.g., Vercel, Railway).

### Vercel Deployment

```bash
vercel env pull .env.vercel.production --environment=production
```

## Security Notes

- **Never commit `.env.local` or `.env.production` to version control**
- Store production secrets in your hosting platform's environment variable manager
- Rotate API keys and secrets regularly
- Use different keys for development and production
- Encrypt sensitive values in the database using the `MASTER_KEY`

## Validation

Run this script to verify all required environment variables are set:

```bash
npm run verify-env
```
