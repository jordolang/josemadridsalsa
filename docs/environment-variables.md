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
- `MASTER_KEY` - 32-character encryption key for service keys

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
