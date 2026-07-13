# Cron Jobs — Jose Madrid Salsa

Cron jobs are managed via **[cron-job.org](https://console.cron-job.org)** (not Vercel, which requires Pro plan for sub-daily crons).

## Authentication

All cron endpoints are protected by a `Bearer` token:

```
Authorization: Bearer <CRON_SECRET>
```

The `CRON_SECRET` env var is set in both `.env.local` and Vercel.

---

## Active Jobs

| Job ID | Name | URL | Schedule (ET) | Timeout |
|--------|------|-----|---------------|---------|
| 7444035 | Abandoned Cart Recovery | `POST /api/cron/abandoned-cart` | Daily at 10:00 AM | 60s |
| 7444036 | Dashboard Analysis | `GET /api/cron/dashboard-analysis` | Every 5 hours (midnight, 5am, 10am, 3pm, 8pm) | 120s |
| 7442615 | Email Automation | `GET /api/cron/email-automation` | Every 5 minutes | 60s |
| 7442617 | Email Campaigns | `GET /api/cron/email-campaigns` | Every 5 minutes | 60s |

All jobs target: `https://www.josemadrid.net`

---

## Status Pages

Status pages are managed in the cron-job.org console UI (no REST API available).

To set up/view status pages:
1. Log in at [console.cron-job.org](https://console.cron-job.org)
2. Navigate to **Status Pages** (WiFi/signal icon in sidebar)
3. Create a status page and add the 4 jobs above as monitors

**Suggested Status Page config:**
- **Page title:** Jose Madrid Salsa — System Status
- **Slug:** `josemadrid` → public URL: `https://status.cron-job.org/pages/josemadrid` (or your custom slug)
- **Monitors to include:** All 4 jobs listed above

---

## API Key

The cron-job.org API key is stored as `CRONJOB_API_KEY` in Vercel environment variables.

---

## Adding New Cron Jobs

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <CRONJOB_API_KEY>" \
  -d '{
    "job": {
      "enabled": true,
      "title": "Job Title",
      "url": "https://www.josemadrid.net/api/cron/your-endpoint",
      "requestTimeout": 60,
      "extendedData": {
        "headers": { "Authorization": "Bearer <CRON_SECRET>" }
      },
      "schedule": {
        "timezone": "America/New_York",
        "hours": [-1],
        "mdays": [-1],
        "minutes": [0, 15, 30, 45],
        "months": [-1],
        "wdays": [-1],
        "expiresAt": 0
      }
    }
  }' \
  https://api.cron-job.org/jobs
```
