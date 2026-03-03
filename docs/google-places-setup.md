# Google Places API Setup

This document describes how to set up the Google Places API for fetching retail location photos.

## Prerequisites

1. Google Cloud Platform account
2. Billing enabled on your GCP project

## Setup Steps

### 1. Enable Google Places API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services > Library**
4. Search for "Places API (New)"
5. Click **Enable**

### 2. Create API Key

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the API key
4. (Recommended) Click **Restrict Key**:
   - Set Application restrictions to "IP addresses" or "HTTP referrers"
   - Set API restrictions to "Places API (New)"

### 3. Add to Environment Variables

#### Local Development

Add to `.env.local`:
```
GOOGLE_PLACES_API_KEY=your_api_key_here
```

#### Vercel Deployment

```bash
vercel env add GOOGLE_PLACES_API_KEY
# Paste your API key when prompted
# Select: Production, Preview, Development (all environments)
```

Or via Vercel Dashboard:
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add `GOOGLE_PLACES_API_KEY` with your key
4. Select all environments (Production, Preview, Development)

## Usage

### Fetch Photos for All Locations

```bash
npx tsx scripts/fetch-location-photos.ts
```

This will:
- Fetch photos from Google Places API for all locations without photos
- Fall back to company logos from website domains
- Use placeholder image if no photo/logo found
- Generate a report at `locations-missing-photos.txt`

### Force Re-fetch All Photos

```bash
npx tsx scripts/fetch-location-photos.ts --force
```

This will re-fetch photos for ALL locations, even those that already have them.

## API Quotas & Pricing

- **Text Search**: $32 per 1,000 requests
- **Place Photos**: $7 per 1,000 requests
- **Free tier**: $200 monthly credit (covers ~5,000 searches + photos)

For 175 locations, estimated cost:
- One-time: ~$7 (175 searches + 175 photos)
- Within free tier if done occasionally

## Files

- `lib/google-places.ts` - API helper functions
- `scripts/fetch-location-photos.ts` - Photo fetching script
- `locations-missing-photos.txt` - Report of locations needing manual photos

## Troubleshooting

### "GOOGLE_PLACES_API_KEY not configured"
- Ensure `.env.local` contains the key
- Restart dev server after adding environment variables

### Rate Limiting (429 errors)
- The script includes exponential backoff
- Reduce concurrency in `fetch-location-photos.ts` (default: 5)

### No photos found
- Some businesses may not have photos in Google Places
- Script will fall back to company logo or placeholder
- Check `locations-missing-photos.txt` for details

## Manual Photo Upload

For locations in `locations-missing-photos.txt`, you can:

1. Upload photos manually to `/public/images/locations/`
2. Update database directly:
```sql
UPDATE retail_locations 
SET photo_url = '/images/locations/business-name.jpg'
WHERE business_name = 'Business Name' AND city = 'City';
```

Or use Prisma Studio:
```bash
npm run db:studio
```
