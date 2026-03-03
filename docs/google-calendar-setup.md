# Google Calendar & Maps Integration

The **On the Move** section on `where-is-jose` reads upcoming events from Google Calendar and plots any locations on an interactive Google Map. Follow the steps below to finish wiring this up for your Google Workspace account.

## 1. Enable APIs

1. In the [Google Cloud Console](https://console.cloud.google.com/), select the project you use for Jose Madrid Salsa.
2. Enable both **Google Calendar API** and **Maps JavaScript API** (the latter also grants access to the Geocoding service used inside the map).

## 2. Create a Service Account

1. Create a service account (or reuse an existing one) with access to the project above.
2. Generate a JSON key and copy the email and private key values. The key must stay private.
3. Share the target calendar (the one that stores the event schedule) with the service account email. Grant it at least the **See all event details** permission level.  
   - Optionally specify a user to impersonate by setting `GOOGLE_CALENDAR_IMPERSONATED_USER` if the calendar lives in a workspace that requires domain-wide delegation.

## 3. Add Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="pk_...from Google Cloud..."
GOOGLE_SERVICE_ACCOUNT_EMAIL="service-account@your-project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID="primary-or-calendar-id@group.calendar.google.com"
# Optional:
# GOOGLE_CALENDAR_IMPERSONATED_USER="user@your-domain.com"
```

Notes:

- Keep the newline characters (`\n`) inside the private key exactly as provided in the downloaded JSON.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` can stay restricted to your production and preview domains; just allow localhost during development.

## 4. Install Dependencies

After pulling these changes, install packages so the new integration compiles:

```bash
npm install
```

## 5. Verify the Integration

1. Start the dev server: `npm run dev`.
2. Visit `/where-is-jose` and confirm that the map loads.
3. Add an event with a location string (address or `lat,lng`) to the connected calendar; the map should place a marker automatically.  
   - Use the refresh button in the UI or append `?skipCache=true` to `/api/calendar` to bypass the five-minute server cache while testing.

If you change credentials later, restart the Next.js server so the new environment variables load.
