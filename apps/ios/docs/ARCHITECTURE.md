# Mobile App Architecture

This document describes the architecture of the Jose Madrid Salsa mobile application.

---

## Pattern: MVVM (Model-View-ViewModel)

The app follows a simplified MVVM pattern adapted for React Native with Zustand:

```
┌──────────────────────────────────────────────────┐
│                     View Layer                    │
│         (Expo Router screens + components)        │
│                                                   │
│   app/(tabs)/index.tsx    components/ProductCard  │
│   app/(tabs)/fundraising  app/cart.tsx            │
│   app/(tabs)/admin                                │
└──────────────┬───────────────────────┬────────────┘
               │ reads state           │ dispatches actions
               ▼                       ▼
┌──────────────────────────────────────────────────┐
│                  ViewModel Layer                  │
│              (Zustand stores + hooks)             │
│                                                   │
│   store/cartStore.ts                              │
│   - items, addItem, removeItem, clearCart         │
│   - totalQuantity, totalPrice (derived state)    │
└──────────────┬───────────────────────────────────┘
               │ fetches / persists
               ▼
┌──────────────────────────────────────────────────┐
│                   Model Layer                     │
│            (API client + local storage)           │
│                                                   │
│   lib/api.ts          → Next.js backend REST API │
│   AsyncStorage        → Cart persistence          │
│   Expo Secure Store   → Auth tokens (planned)     │
└──────────────────────────────────────────────────┘
```

---

## Module Structure

### Screens (`app/`)

File-based routing via Expo Router. Each file in `app/` maps to a route.

| File | Route | Purpose |
|------|-------|---------|
| `_layout.tsx` | -- | Root layout, wraps app in `StripeProvider` |
| `(tabs)/_layout.tsx` | -- | Tab navigator with Storefront, Fundraising, Admin tabs |
| `(tabs)/index.tsx` | `/` | Product catalog with grid view |
| `(tabs)/fundraising.tsx` | `/fundraising` | Campaign dashboard with progress tracking |
| `(tabs)/admin.tsx` | `/admin` | POS terminal with Stripe Terminal integration |
| `cart.tsx` | `/cart` | Shopping cart (presented as modal) |

### Components (`components/`)

Reusable UI components shared across screens.

| Component | Purpose |
|-----------|---------|
| `ProductCard` | Displays product image, name, price, and add-to-cart button |

### State Management (`store/`)

Zustand stores with middleware for persistence.

| Store | Middleware | Purpose |
|-------|-----------|---------|
| `cartStore` | `persist` (AsyncStorage) | Cart items, quantities, totals |

### API Layer (`lib/`)

Centralized API client for backend communication.

| Module | Purpose |
|--------|---------|
| `api.ts` | Base URL resolution, `fetchSalsas()` endpoint |

---

## Data Flow

### Product Browsing Flow

```
1. StorefrontScreen mounts
2. useEffect calls fetchSalsas() from lib/api.ts
3. API client sends GET /api/salsas to Next.js backend
4. Response parsed, image URLs resolved to absolute paths
5. FlatList renders ProductCard components
6. User taps "Add to Cart" → cartStore.addItem()
7. Cart count updates in header via useCartStore selector
```

### Cart and Checkout Flow

```
1. User navigates to /cart (modal presentation)
2. CartScreen reads items from cartStore
3. User can remove items or clear cart
4. "Proceed to Checkout" triggers Stripe Mobile payment flow
5. Cart persists across app restarts via AsyncStorage
```

### POS Terminal Flow

```
1. Admin navigates to Admin POS tab
2. Taps "Discover Bluetooth Readers"
3. Stripe Terminal SDK scans for nearby readers
4. Reader connects via Bluetooth
5. Payment captured through physical card reader
6. Order recorded via backend API
```

---

## Navigation Architecture

```
Stack Navigator (Root)
├── Tab Navigator
│   ├── Storefront (index)     ← Default tab
│   ├── Fundraising
│   └── Admin POS
└── Cart (modal presentation)
```

- **Stack Navigator** at root provides modal presentation for the cart
- **Tab Navigator** groups the three main sections
- Brand color `#FF0000` used for active tab tint
- Brand accent `#d32f2f` used for action buttons throughout

---

## State Persistence

| Data | Storage | Strategy |
|------|---------|----------|
| Cart items | AsyncStorage (via Zustand persist) | Survives app restarts |
| Auth tokens | Expo Secure Store (planned) | Encrypted device storage |
| User preferences | AsyncStorage (planned) | App settings |

---

## Shared Patterns with Web Project

The mobile app intentionally mirrors patterns from the Next.js web project:

| Pattern | Web | Mobile |
|---------|-----|--------|
| State management | Zustand | Zustand |
| Routing | Next.js App Router (file-based) | Expo Router (file-based) |
| Payments | Stripe Elements | Stripe React Native SDK |
| Form validation | Zod (planned) | Zod (planned) |
| API format | `ApiResponse<T>` envelope | Same backend endpoints |
