# Social Media Setup (Admin → Social)

This is the **one-time** setup for posting to Facebook, Instagram, X (Twitter),
TikTok, and Google Business from the admin panel. You only do this once. After
it's done, connecting an account and posting are genuinely one click.

> **Why any setup at all?** Facebook, X, TikTok, and Google require *every*
> app that posts on their behalf to be registered with them — there is no way
> around it (paid tools like Buffer just did this for you behind the scenes).
> You register a free developer app once, paste a few values, and you're done.

The admin **Accounts** tab shows, per platform, whether it's **Configured** or
**Setup required**, the exact **Redirect URI** to paste, and the precise
settings still missing. Use that screen as your live checklist — it always
tells the truth about what's actually wired up.

## The one value every platform needs: the Redirect URI

```
https://YOUR-DOMAIN/api/social/oauth/callback
```

For Jose Madrid Salsa that's `https://www.josemadrid.net/api/social/oauth/callback`.
Paste it into each platform's developer console exactly (the Accounts tab has a
copy button with the right value for your current environment).

## Per-platform

### Facebook + Instagram (one app covers both)
1. Go to https://developers.facebook.com/apps → create an app (type **Business**).
2. Add the **Facebook Login** product.
3. Facebook Login → Settings → **Valid OAuth Redirect URIs** → paste the Redirect URI.
4. App Settings → Basic → copy **App ID** and **App Secret** into:
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`
5. Make sure you're an admin of the Facebook **Page** you want to post to.
6. For Instagram: convert it to a Business/Creator account and link it to that Page.
   Connecting Facebook automatically detects the linked Instagram account.

### X (Twitter)
1. Go to https://developer.x.com/en/portal/dashboard → create a Project + App.
2. Enable **OAuth 2.0**, app type **Web App**, permissions **Read and Write**.
3. Add the Redirect URI to the app's **Callback URLs**.
4. Copy the OAuth 2.0 **Client ID** and **Client Secret** into:
   - `TWITTER_CLIENT_ID`
   - `TWITTER_CLIENT_SECRET`

### TikTok
1. Go to https://developers.tiktok.com/apps → create an app.
2. Add the **Login Kit** and **Content Posting API** products.
3. Add the Redirect URI to the app's redirect URIs.
4. Copy the **Client Key** and **Client Secret** into:
   - `TIKTOK_CLIENT_KEY`
   - `TIKTOK_CLIENT_SECRET`
5. TikTok must approve Content Posting API access before videos go fully public.

### Google Business
1. In https://console.cloud.google.com/apis/credentials create **OAuth 2.0**
   credentials (Web application).
2. Add the Redirect URI to **Authorized redirect URIs**.
3. Copy **Client ID** / **Client Secret** into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Enable the **Business Profile API** for the project and request API access
   (Google gates this — apply early).

## Where to put these values

- **Local dev:** add them to `.env` (see `.env.example` for the full list).
- **Production (Vercel):** Project → Settings → Environment Variables, then redeploy.

## Scheduled posts

Scheduling is executed by the endpoint `/api/cron/social-publish`, which
publishes any post whose scheduled time has passed. It's triggered every 15
minutes by a **GitHub Actions** workflow (`.github/workflows/social-publish.yml`)
rather than a Vercel Cron, because the Vercel free (Hobby) plan caps cron jobs
to a daily cadence and a small count that this project already uses. GitHub
Actions is free on this public repo and gives real 15-minute granularity — so a
post scheduled for 2:10pm goes out by ~2:15pm, not the next day.

**Works with no extra setup** against `https://www.josemadrid.net`.
Optional hardening: set `CRON_SECRET` in Vercel **and** add a matching GitHub
Actions secret named `CRON_SECRET`. To point at a different domain, set a repo
variable `CRON_TARGET_URL`.

(Immediate "Publish now" posts are unaffected — they post in real time the
moment you click, with no cron involved.)

## What works once configured

| Platform        | Connect | Post text/photos | Carousel/Video | Product → Shop sync |
|-----------------|:------:|:----------------:|:--------------:|:-------------------:|
| Facebook        | ✓ | ✓ | ✓ | ✓ (Catalog/Marketplace) |
| Instagram       | ✓ (via FB) | ✓ | ✓ | — |
| X (Twitter)     | ✓ | ✓ | photos | — |
| TikTok          | ✓ | video | video | ✓ (TikTok Shop) |
| Google Business | ✓ | ✓ (local post) | — | — |
