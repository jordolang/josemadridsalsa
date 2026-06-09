# Jose Madrid Salsa -- Mobile App

**React Native (Expo) companion app for the Jose Madrid Salsa e-commerce platform.**

---

## Overview

The mobile app extends the Jose Madrid Salsa web platform to iOS and Android devices. It provides three core capabilities:

1. **Storefront** -- Browse and purchase salsas directly from a mobile device
2. **Fundraising Dashboard** -- Manage campaigns, track progress, and coordinate sellers on the go
3. **Admin POS Terminal** -- Process in-person payments via Stripe Terminal Bluetooth card readers

The app connects to the same Next.js backend that powers the web storefront, sharing the product catalog, order system, and payment infrastructure.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native 0.81 via Expo SDK 54 |
| **Router** | Expo Router 6 (file-based routing) |
| **Language** | TypeScript 5.9 |
| **State** | Zustand 5 (with AsyncStorage persistence) |
| **Payments** | Stripe React Native SDK + Stripe Terminal SDK |
| **Storage** | Expo Secure Store (credentials), AsyncStorage (cart) |
| **Backend** | Shared Next.js API (see web project) |

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | 20 or 22 (matches web project `.nvmrc`) |
| Expo CLI | Included via `npx expo` (no global install needed) |
| iOS Simulator | Xcode 16+ (macOS only) |
| Android Emulator | Android Studio with API 34+ |
| Web backend running | `npm run dev` in the project root on port 3000 |

---

## Quick Start

```bash
# 1. Navigate to the mobile directory
cd mobile

# 2. Install dependencies
npm install

# 3. Start the Expo development server
npx expo start

# 4. Run on a specific platform
npm run ios       # iOS simulator
npm run android   # Android emulator
npm run web       # Web browser (limited support)
```

> The app expects the Next.js backend to be running at `localhost:3000` (iOS) or `10.0.2.2:3000` (Android emulator). See [API-INTEGRATION.md](./API-INTEGRATION.md) for details.

---

## Project Structure

```
mobile/
├── app/                    # Expo Router screens (file-based routing)
│   ├── _layout.tsx         # Root layout (StripeProvider wrapper)
│   ├── cart.tsx            # Shopping cart (modal presentation)
│   └── (tabs)/            # Tab navigator group
│       ├── _layout.tsx    # Tab bar configuration
│       ├── index.tsx      # Storefront screen
│       ├── fundraising.tsx # Fundraising dashboard
│       └── admin.tsx      # Admin POS terminal
│
├── components/            # Reusable UI components
│   └── ProductCard.tsx    # Product display card with add-to-cart
│
├── lib/                   # Utilities and API layer
│   └── api.ts            # Backend API client (base URL, fetch helpers)
│
├── store/                 # Zustand state management
│   └── cartStore.ts      # Cart state with AsyncStorage persistence
│
├── assets/               # App icons, splash screens
├── app.json              # Expo configuration
├── package.json          # Dependencies and scripts
└── tsconfig.json         # TypeScript configuration
```

---

## Architecture Decisions

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture overview. Key decisions:

- **Expo over bare React Native** -- Managed workflow simplifies builds, OTA updates, and dependency management
- **Expo Router** -- File-based routing mirrors the Next.js App Router conventions used in the web project
- **Zustand** -- Same state management library used in the web project, enabling pattern reuse
- **Shared backend** -- No separate mobile API; the app calls the existing Next.js REST endpoints directly

---

## Related Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | MVVM pattern, module structure, data flow |
| [API-INTEGRATION.md](./API-INTEGRATION.md) | Backend connection, endpoints, authentication |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | Build, run, test, and debug instructions |
| [../CHANGELOG.md](../CHANGELOG.md) | Mobile-specific change history |
| [Web README](../../README.md) | Main project documentation |
