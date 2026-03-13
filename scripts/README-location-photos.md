# Location Photo Fetcher

This script fetches photos for retail locations using the Google Places API and updates the `locations-data.json` file.

## Setup

### 1. Get a Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Places API (New)**
4. Go to **APIs & Services > Credentials**
5. Click **Create Credentials > API Key**
6. **Important**: Restrict the API key:
   - Click on the key to edit it
   - Under "API restrictions", select "Restrict key"
   - Enable only: **Places API (New)**
   - Under "Application restrictions", you can restrict by IP or leave unrestricted for local development

### 2. Add API Key to Environment

Add one of these to your `.env.local` file:

```bash
GOOGLE_PLACES_API_KEY=your_api_key_here
# OR
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Usage

### Fetch photos for locations that don't have them:

```bash
npm run locations:update-photos
```

### Force re-fetch all photos:

```bash
npm run locations:update-photos -- --force
```

Or directly:

```bash
node scripts/update-location-photos.mjs
node scripts/update-location-photos.mjs --force
```

## What It Does

1. Reads `lib/locations/locations-data.json`
2. For each location without a photo (or all locations with `--force`):
   - Searches Google Places API for the business
   - Finds the best photo (landscape, high resolution)
   - Updates the photoUrl field
3. Saves the updated JSON file
4. Prints a summary report

## Rate Limiting

The script includes:
- 150ms delay between requests
- Exponential backoff retry logic
- Respects Google API rate limits

For 149 locations, expect ~25-30 minutes to complete.

## Cost

Google Places API pricing (as of 2024):
- Text Search: $32 per 1,000 requests
- Photo requests: Free (served via CDN)

For 149 locations:
- First run: ~149 searches = $4.77
- Subsequent runs (only new locations): minimal cost

## Troubleshooting

### "GOOGLE_PLACES_API_KEY not configured"
- Make sure you've added the API key to `.env.local`
- Restart your terminal/IDE after adding the key

### "API error (403)"
- Check that Places API (New) is enabled in Google Cloud Console
- Verify API key restrictions aren't blocking your requests

### "No Google Places match found"
- Some business names/addresses may not be in Google's database
- Consider manually adding photos for these locations
- Check the markdown file for typos in business names/addresses

## After Running

1. **Commit the updated JSON**: The photos are saved as URLs in `locations-data.json`
2. **Rebuild**: Run `npm run build` to regenerate the location data
3. **Deploy**: Push changes to production

The photo URLs point to Google's CDN and will be cached by browsers.
