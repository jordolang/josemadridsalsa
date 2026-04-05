# Development Guide

Step-by-step instructions for building, running, testing, and debugging the Jose Madrid Salsa mobile app.

---

## Environment Setup

### 1. Install System Dependencies

**macOS (iOS + Android development):**

```bash
# Install Xcode from the Mac App Store (iOS simulator requires macOS)
xcode-select --install

# Install Android Studio for Android emulator
# Download from https://developer.android.com/studio

# Expo CLI is used via npx (no global install needed)
```

**Windows/Linux (Android development only):**

```bash
# Install Android Studio
# Download from https://developer.android.com/studio

# Expo CLI is used via npx (no global install needed)
```

### 2. Configure Android Studio

1. Open Android Studio > SDK Manager
2. Install Android SDK Platform 34 (or latest)
3. Install Android SDK Build-Tools
4. Create a virtual device via AVD Manager (Pixel 7 recommended)

### 3. Install Project Dependencies

```bash
cd mobile
npm install
```

### 4. Configure Stripe Keys

The mobile app loads Stripe keys from environment variables at build time
via `app.config.ts` and `expo-constants`.

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and add your Stripe publishable key
# Get your key from https://dashboard.stripe.com/apikeys
# Use pk_test_... for development, pk_live_... for production
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

The key is read at runtime in `lib/payments/stripe-config.ts` via
`Constants.expoConfig.extra.stripePublishableKey`. Never commit real
Stripe keys -- only the `.env.example` placeholder is checked in.

---

## Running the App

### Development Server

```bash
# Start Expo dev server (presents options for all platforms)
npx expo start

# Direct platform launch
npx expo start --ios        # iOS simulator
npx expo start --android    # Android emulator
npx expo start --web        # Web browser
```

### With Backend

The mobile app requires the Next.js backend for product data and API calls:

```bash
# Terminal 1: Start the web backend (from project root)
npm run dev

# Terminal 2: Start the mobile app
cd mobile
npx expo start
```

### Physical Device Testing

1. Install **Expo Go** from the App Store or Google Play
2. Run `npx expo start` in the mobile directory
3. Scan the QR code displayed in the terminal
4. The app loads on your physical device

> Physical devices must be on the same Wi-Fi network as your development machine.

---

## Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `npx expo start` | Launch Expo dev server with platform picker |
| `ios` | `npx expo start --ios` | Launch directly in iOS Simulator |
| `android` | `npx expo start --android` | Launch directly in Android Emulator |
| `web` | `npx expo start --web` | Launch in web browser |

---

## Project Conventions

### File Naming

- **Screens**: `kebab-case.tsx` in `app/` directory (Expo Router convention)
- **Components**: `PascalCase.tsx` in `components/` directory
- **Stores**: `camelCaseStore.ts` in `store/` directory
- **Utilities**: `camelCase.ts` in `lib/` directory

### Code Style

Follow the same TypeScript conventions as the web project:

- Use `interface` for object shapes, `type` for unions and intersections
- Avoid `any` -- use `unknown` and narrow safely
- Immutable state updates (Zustand handles this via `set()`)
- No `console.log` in production code

### Import Paths

Use relative imports within the mobile project:

```typescript
// From a screen
import { ProductCard } from '../../components/ProductCard';
import { useCartStore } from '../../store/cartStore';
import { fetchSalsas } from '../../lib/api';
```

---

## Debugging

### React Native Debugger

1. Press `j` in the Expo dev server to open the Chrome debugger
2. Use React DevTools for component inspection
3. Use the Network tab to monitor API calls

### Common Debug Scenarios

**App crashes on launch:**
- Check Expo dev server output for error stack traces
- Verify all dependencies are installed (`npm install`)
- Clear Expo cache: `npx expo start -c`

**Blank screen with no errors:**
- Check that the root layout exports a valid component
- Verify `StripeProvider` has a publishable key

**API calls failing:**
- Confirm the backend is running on port 3000
- Check the platform-specific base URL in `lib/api.ts`
- For Android, verify `10.0.2.2` is correctly configured

---

## Building for Production

### Expo Application Services (EAS)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Configure the project
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

### Over-the-Air Updates

Expo supports OTA updates for JavaScript-only changes:

```bash
eas update --branch production --message "Description of changes"
```

> Native dependency changes (e.g., adding a new Expo plugin) require a full rebuild.

---

## Testing (Planned)

The following testing infrastructure is planned for the mobile app:

| Type | Framework | Coverage Target |
|------|-----------|----------------|
| Unit | Jest + React Native Testing Library | 80%+ |
| Component | React Native Testing Library | Key components |
| E2E | Detox or Maestro | Critical flows |

### Running Tests (Once Configured)

```bash
# Unit and component tests
npm test

# With coverage
npm test -- --coverage

# E2E tests
npm run test:e2e
```

---

## Stripe Terminal Setup (Admin POS)

The Admin POS screen uses Stripe Terminal for in-person payments:

1. Ensure the backend provides a `/api/terminal/connection_token` endpoint
2. Pair a Stripe-certified Bluetooth card reader
3. The app discovers readers via the Stripe Terminal SDK
4. Payments are captured through the physical reader

> Stripe Terminal requires a verified Stripe account with Terminal enabled. Test mode works with simulated readers.
