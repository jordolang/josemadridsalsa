# Fix Google Places API Key Restrictions

## The Problem

Your API key is returning: **"Requests from referer <empty> are blocked"**

This means the API key has HTTP referrer restrictions that prevent server-side usage.

## Solution: Update API Key Restrictions

### Option 1: Remove Restrictions (Fastest - for development)

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your API key: `AIzaSyAnBwcUie1AXcNtXMS3-L8_YpYbjWxwWwg`
3. Click to edit it
4. Under **Application restrictions**, select:
   - ✅ **None** (for development/testing)
   - Or **IP addresses** and add your current IP
5. Click **Save**
6. Wait 1-2 minutes for changes to propagate

### Option 2: Create Server-Side API Key (Recommended)

Better security practice - create a separate key for server-side scripts:

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Edit the new key:
   - Name it: "Jose Madrid - Server Side"
   - **Application restrictions**: IP addresses
   - Add your server/local IP address
   - **API restrictions**: Restrict to "Places API (New)"
4. Copy the new key and replace in `.env.local`:
   ```bash
   GOOGLE_PLACES_API_KEY=your_new_key_here
   ```

### Option 3: Keep Current Key, Add IP Restriction

1. Find your current IP: https://api.ipify.org
2. In Google Cloud Console → Edit API key
3. Under **Application restrictions**, select **IP addresses**
4. Click **ADD AN ITEM** and paste your IP
5. Save and wait 1-2 minutes

## After Fixing

Run the photo fetcher again:

```bash
npm run locations:update-photos
```

## Security Note

**Never commit API keys to git!** 

The `.env.local` file is already in `.gitignore`, so your keys stay private.

For production, use environment variables in your hosting platform (Vercel/Netlify/etc) instead of committing keys.
