# Google Maps & Places API Setup

This document provides instructions for setting up the Google Maps and Places API to enable the location map, street view, and Google reviews features on the Jose Madrid Salsa website.

## Required APIs

The following Google Cloud APIs need to be enabled:
1. **Maps Embed API** - For displaying the interactive map
2. **Street View Static API** - For the street view feature
3. **Maps Static API** - For static map images
4. **Places API (New)** - For fetching Google reviews

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project (required for API usage)

### 2. Enable Required APIs

1. Navigate to **APIs & Services** > **Library**
2. Search for and enable the following APIs:
   - Maps Embed API
   - Street View Static API
   - Maps Static API
   - Places API (New)

### 3. Create API Keys

#### Option A: Single API Key (Simpler)
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the generated API key
4. Click **Edit API key** to add restrictions:
   - **Application restrictions**: HTTP referrers (recommended)
     - Add your website domain (e.g., `josemadridsalsa.com/*`, `localhost:3000/*`)
   - **API restrictions**: Select the APIs listed above

#### Option B: Separate API Keys (More Secure)
Create two separate API keys:

1. **Public API Key** (for Maps Embed API):
   - Application restrictions: HTTP referrers
   - API restrictions: Maps Embed API, Street View Static API, Maps Static API
   
2. **Server API Key** (for Places API):
   - Application restrictions: None (server-side only)
   - API restrictions: Places API (New)

### 4. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Google Maps & Places API
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-public-maps-api-key"
GOOGLE_PLACES_API_KEY="your-server-side-places-api-key"

# Optional: Google Place ID for faster lookups
GOOGLE_PLACE_ID="ChIJXXXXXXXXXXXXXX"
GOOGLE_PLACE_NAME="Jose Madrid Salsa"
```

### 5. Find Your Google Place ID

To get the Google Place ID for Jose Madrid Salsa:

1. Visit [Place ID Finder](https://developers.google.com/maps/documentation/places/web-service/place-id)
2. Enter the business address: `601 Putnam Ave, Zanesville, OH 43701`
3. Copy the Place ID (starts with "ChIJ...")
4. Add it to `GOOGLE_PLACE_ID` in your `.env.local`

**Note**: If you don't provide a Place ID, the system will search by business name, but this is less reliable and slower.

### 6. API Usage & Billing

Google Maps provides a monthly credit of $200, which covers:
- Maps Embed API: Free for basic usage
- Street View Static API: $7 per 1,000 requests (after free tier)
- Maps Static API: $2 per 1,000 requests (after free tier)
- Places API (New): $17 per 1,000 requests (after free tier)

For a typical small business website, the free tier should be sufficient.

### 7. Testing

After setting up the API keys:

1. Restart your development server: `npm run dev`
2. Visit the homepage
3. You should see:
   - Interactive map with business location
   - Toggle between Map View and Street View
   - Static map image in the sidebar
   - Google reviews section with review cards

### Troubleshooting

#### Map not displaying
- Check that `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is set
- Verify the API key has Maps Embed API enabled
- Check browser console for API errors
- Ensure HTTP referrer restrictions match your domain

#### Reviews not loading
- Verify `GOOGLE_PLACES_API_KEY` is set
- Ensure Places API (New) is enabled
- Check the Place ID or business name is correct
- Review server logs for API errors

#### "This page can't load Google Maps correctly"
- Usually means the API key is invalid or restricted
- Check API key restrictions in Google Cloud Console
- Verify billing is enabled for the project

## Security Best Practices

1. **Never commit API keys** to version control
   - Use `.env.local` for local development
   - Use environment variables in production (Vercel, etc.)

2. **Use API restrictions**
   - Restrict public keys to specific APIs
   - Use HTTP referrer restrictions for frontend keys

3. **Monitor usage**
   - Set up billing alerts in Google Cloud Console
   - Monitor API usage in the Credentials page

4. **Rotate keys periodically**
   - Generate new API keys every 6-12 months
   - Delete old keys after rotation

## Additional Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [Maps Embed API Guide](https://developers.google.com/maps/documentation/embed/get-started)
- [Places API (New) Documentation](https://developers.google.com/maps/documentation/places/web-service/overview)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
