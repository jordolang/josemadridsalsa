# Google Service Account Configuration

## Service Account Details

The Jose Madrid Salsa project uses a dedicated Google Cloud service account for API access and authentication.

### Service Account Information
- **Email**: `service-josemadrid@quick-flame-477020-k3.iam.gserviceaccount.com`
- **Name**: `service-josemadrid`
- **Unique ID**: `105527441625968712666`
- **Project**: `quick-flame-477020-k3`

## API Key
**Unified API Key**: `AIzaSyDxe-YN1kZ0YMFBz2c0RYWVXNWyE-Beyag`

This API key is used across all Google services including:
- Google Maps Embed API
- Street View Static API
- Maps Static API
- Places API (New)
- Google Calendar API
- Other Google Cloud services

## Environment Variables

The following environment variables have been configured:

```bash
# Google API Key
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="AIzaSyDxe-YN1kZ0YMFBz2c0RYWVXNWyE-Beyag"
GOOGLE_PLACES_API_KEY="AIzaSyDxe-YN1kZ0YMFBz2c0RYWVXNWyE-Beyag"
GOOGLE_CLIENT_ID="AIzaSyDxe-YN1kZ0YMFBz2c0RYWVXNWyE-Beyag"

# Service Account Details
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-josemadrid@quick-flame-477020-k3.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_NAME="service-josemadrid"
GOOGLE_SERVICE_ACCOUNT_ID="105527441625968712666"

# OAuth (if needed)
GOOGLE_CLIENT_SECRET="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"
```

## Service Account Usage

### For Server-Side Operations
When making server-side API calls that require authentication beyond the API key, use the service account email:

```typescript
// Example: Using service account with Google APIs
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    // Note: You'll need to add GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY if using this pattern
  },
  scopes: ['https://www.googleapis.com/auth/calendar'],
});
```

### For API Key Operations
Most operations (Maps, Places, etc.) only require the API key:

```typescript
// Client-side (Maps Embed)
const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Server-side (Places API)
const apiKey = process.env.GOOGLE_PLACES_API_KEY;
```

## Permissions and Roles

The service account should have the following roles in Google Cloud Console:

- **Service Account User** - Basic service account usage
- **API Keys Admin** (optional) - For managing API keys
- Access to enabled APIs:
  - Maps Embed API
  - Street View Static API
  - Maps Static API
  - Places API (New)
  - Google Calendar API (if using calendar features)

## Security Best Practices

### API Key Restrictions
In Google Cloud Console, configure the following restrictions for the API key:

1. **Application Restrictions**:
   - Set HTTP referrer restrictions
   - Add allowed domains:
     - `josemadrid.net/*`
     - `josemadridsalsa.com/*`
     - `*.vercel.app/*` (for preview deployments)
     - `localhost:3000/*` (for development)

2. **API Restrictions**:
   - Restrict to only the APIs you're using
   - Don't leave it unrestricted

### Environment Variables
- ✅ Never commit API keys to version control
- ✅ Use `.env.local` for local development
- ✅ Use Vercel environment variables for production
- ✅ Rotate keys periodically (every 6-12 months)

## Service Account Key File

If you need to use a service account key file (JSON) for certain operations:

1. **Generate Key**:
   - Go to Google Cloud Console > IAM & Admin > Service Accounts
   - Find `service-josemadrid@quick-flame-477020-k3.iam.gserviceaccount.com`
   - Click **Keys** tab
   - Add Key > Create New Key > JSON
   - Save securely (DO NOT commit to git)

2. **Store Securely**:
   ```bash
   # Store the JSON key content as an environment variable
   GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
   ```

3. **Use in Code**:
   ```typescript
   const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '{}');
   const auth = new google.auth.GoogleAuth({
     credentials,
     scopes: ['required-scopes'],
   });
   ```

## Testing the Configuration

To verify the API key and service account are working:

```bash
# Start the dev server
npm run dev

# Visit http://localhost:3000
# The following should work:
# - Interactive map on homepage
# - Street view toggle
# - Google reviews display
# - Any calendar integrations
```

## Troubleshooting

### API Key Not Working
1. Check that the key is properly set in environment variables
2. Verify the API is enabled in Google Cloud Console
3. Check HTTP referrer restrictions allow your domain
4. Look for error messages in browser console or server logs

### Service Account Issues
1. Verify the service account email is correct
2. Check that required APIs are enabled
3. Ensure proper IAM roles are assigned
4. For key file issues, verify JSON format is valid

### Rate Limits
If you hit rate limits:
1. Check Google Cloud Console for quota information
2. Consider implementing caching for API responses
3. Review usage patterns and optimize API calls

## Cost Monitoring

Set up billing alerts in Google Cloud Console:
1. Navigate to Billing > Budgets & alerts
2. Create a budget alert
3. Set threshold at $50, $100, and $150
4. Add your email for notifications

Monthly free tier should cover:
- ~28,000 map loads
- ~7,000 street view requests
- ~11,000 static map requests
- ~1,000 places API requests

## Related Documentation

- [Google Maps Setup](./GOOGLE_MAPS_SETUP.md)
- [Google Reviews Setup](./GOOGLE_REVIEWS_SETUP.md)
- [Location Map Feature](./LOCATION_MAP_FEATURE.md)
- [Google Cloud IAM Documentation](https://cloud.google.com/iam/docs/service-accounts)
