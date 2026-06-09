# API Integration

This document describes how the mobile app connects to the Jose Madrid Salsa Next.js backend.

---

## Backend Connection

The mobile app shares the same backend as the web storefront. All API calls go to the Next.js server running the existing REST endpoints.

### Base URL Resolution

The API base URL is determined at runtime based on the environment and platform:

```
Development (__DEV__ = true):
  iOS Simulator  → http://localhost:3000
  Android Emulator → http://10.0.2.2:3000

Production:
  All platforms  → https://josemadridsalsa.com
```

**Why `10.0.2.2`?** Android emulators use a virtual network where `localhost` refers to the emulator itself. The address `10.0.2.2` is a special alias that routes to the host machine's `localhost`.

Configuration is in `lib/api.ts`.

---

## Available Endpoints

### Currently Implemented

| Method | Endpoint | Purpose | Mobile Screen |
|--------|----------|---------|---------------|
| `GET` | `/api/salsas` | Fetch product catalog | Storefront |

### Planned Integrations

| Method | Endpoint | Purpose | Mobile Screen |
|--------|----------|---------|---------------|
| `POST` | `/api/payment` | Create Stripe PaymentIntent | Cart/Checkout |
| `GET` | `/api/fundraiser/campaigns` | Fetch active campaigns | Fundraising |
| `POST` | `/api/terminal/connection_token` | Stripe Terminal token | Admin POS |
| `POST` | `/api/orders` | Create order after payment | Cart/Checkout |
| `GET` | `/api/orders/:id` | Order details and tracking | Account |
| `POST` | `/api/auth/login` | User authentication | Auth |
| `POST` | `/api/auth/register` | User registration | Auth |

---

## Request Format

All requests use standard `fetch` with JSON headers:

```typescript
const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
  method: 'GET',
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});
```

### Authentication (Planned)

Authenticated requests will include a Bearer token stored in Expo Secure Store:

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
}
```

---

## Response Format

> **Note:** Not all backend endpoints currently use the `ApiResponse<T>` envelope. Some endpoints (e.g., `/api/salsas`) return raw JSON arrays directly. The mobile app should handle both formats gracefully during the transition to a consistent envelope pattern.

The backend's target response envelope:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}
```

---

## Image URL Handling

Product images from the backend may use relative paths (e.g., `/images/products/salsa.jpg`). The mobile app converts these to absolute URLs by prepending `API_BASE_URL`:

```typescript
if (item.images[0].startsWith('/')) {
  item.images[0] = `${API_BASE_URL}${item.images[0]}`;
}
```

This conversion happens in the Storefront screen after fetching product data.

---

## Error Handling

The current API client follows a fail-safe pattern:

- Network errors are caught and logged via `console.error` (development only -- **must be replaced with a proper logger before production**)
- Failed requests return empty arrays instead of throwing
- UI displays empty state messages when no data is available

As the app matures, error handling should be enhanced with:
- A structured logger replacing `console.error` (no `console.*` in production code)
- User-facing error messages via `Alert` or toast notifications
- Retry logic for transient network failures
- Offline detection and queued requests

---

## Development Setup

To test the mobile app against the local backend:

1. Start the Next.js dev server in the project root:
   ```bash
   npm run dev
   ```

2. Verify the server is running at `http://localhost:3000`

3. Start the Expo dev server from the `mobile/` directory:
   ```bash
   cd mobile
   npm start
   ```

4. Launch the app on your target platform:
   - **iOS Simulator**: Press `i` in the Expo CLI
   - **Android Emulator**: Press `a` in the Expo CLI
   - **Physical device**: Scan the QR code with Expo Go

### Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Products not loading | Backend not running | Start `npm run dev` in project root |
| Network error on Android | Wrong base URL | Verify `10.0.2.2` is used (not `localhost`) |
| Images not displaying | Relative URL not resolved | Check image URL conversion in Storefront screen |
| CORS errors | Backend missing CORS headers | Add mobile origin to `next.config.mjs` CORS config |
