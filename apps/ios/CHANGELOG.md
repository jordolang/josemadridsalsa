# Mobile App Changelog

All notable changes to the Jose Madrid Salsa mobile app are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [1.0.0] -- 2026-04-02 -- Initial Release

### Added
- **Storefront tab** -- Product catalog with grid layout, fetched from Next.js backend `/api/salsas`
- **ProductCard component** -- Displays product image, name, price, and add-to-cart button
- **Shopping cart** -- Modal-presented cart with item management (add, remove, clear)
- **Cart persistence** -- Zustand store with AsyncStorage middleware survives app restarts
- **Fundraising dashboard** -- Campaign progress tracking with progress bar and quick actions (share link, request payout, manage sellers, settings)
- **Admin POS terminal** -- Stripe Terminal integration for Bluetooth card reader discovery, wholesale order and inventory scan quick actions
- **API client** -- Centralized fetch layer with platform-aware base URL (localhost for iOS, 10.0.2.2 for Android emulator, production domain for release)
- **Expo Router** -- File-based navigation with tab navigator and modal stack
- **Stripe integration** -- StripeProvider at root layout, Stripe Terminal SDK for POS
- **TypeScript** -- Full TypeScript configuration with strict type checking
