# Google Reviews Setup Guide

This guide explains how to configure Google Reviews to display on your homepage.

## Prerequisites

1. Google Cloud Platform account with billing enabled
2. Google Places API (New) enabled
3. Google My Business profile

## Step 1: Find Your Google Place ID

Your Google Place ID is needed to fetch reviews. You can find it in several ways:

### Method 1: From Google My Business URL
1. Go to your Google My Business profile
2. Look at the URL - it will contain your Place ID
3. Or use the [Google Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)

### Method 2: Using Google Places API
1. Use the Places API Text Search to find your business
2. The response will include a `place_id` field

### Method 3: From Google Maps
1. Search for your business on Google Maps
2. Click on your business listing
3. The URL will contain your Place ID in the format: `ChIJ...`

## Step 2: Enable Google Places API (New)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services > Library**
4. Search for "Places API (New)"
5. Click **Enable**

## Step 3: Create API Key

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the API key
4. (Recommended) Click **Restrict Key**:
   - Set Application restrictions to "HTTP referrers"
   - Add your domain: `https://josemadrid.net/*`
   - Set API restrictions to "Places API (New)"

## Step 4: Add Environment Variables

### Local Development

Add to `.env.local`:
```bash
GOOGLE_PLACES_API_KEY="your_api_key_here"
GOOGLE_PLACE_ID="ChIJ..."  # Your Google Place ID
```

### Vercel Deployment

1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add:
   - `GOOGLE_PLACES_API_KEY` = your API key
   - `GOOGLE_PLACE_ID` = your Place ID
4. Select all environments (Production, Preview, Development)

Or via CLI:
```bash
vercel env add GOOGLE_PLACES_API_KEY
vercel env add GOOGLE_PLACE_ID
```

## Step 5: Verify It Works

1. Deploy your changes
2. Visit your homepage
3. The reviews section should display 9 random reviews from Google My Business
4. Reviews will randomize on each page load

## Features

- **9 Random Reviews**: Displays 9 random reviews on each page load
- **Star Ratings**: Visual 5-star rating display
- **Reviewer Names**: Shows who left each review
- **Full Comments**: Displays complete review text
- **Write Review Link**: Prominent button to leave reviews on Google
- **Total Rating Display**: Shows overall rating and review count

## API Costs

- **Place Details (with reviews)**: $17 per 1,000 requests
- **Free tier**: $200 monthly credit (covers ~11,000 requests)
- **Estimated cost**: ~$0.002 per page load (if cached properly)

## Troubleshooting

### Reviews Not Showing

1. **Check API Key**: Verify `GOOGLE_PLACES_API_KEY` is set correctly
2. **Check Place ID**: Verify `GOOGLE_PLACE_ID` matches your Google My Business profile
3. **Check API Status**: Verify Places API (New) is enabled in Google Cloud Console
4. **Check Billing**: Ensure billing is enabled on your Google Cloud project
5. **Check Logs**: View Vercel function logs for API errors

### Common Errors

- **403 Forbidden**: API key restrictions may be too strict
- **404 Not Found**: Place ID is incorrect
- **429 Too Many Requests**: Rate limit exceeded (consider caching)

## Caching Recommendations

To reduce API costs, consider implementing caching:
- Cache reviews for 1-4 hours (reviews don't change frequently)
- Use Vercel Edge caching or Next.js revalidation
- Randomize reviews on the client side after fetching

