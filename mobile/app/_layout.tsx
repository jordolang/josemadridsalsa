/**
 * Root layout for the mobile application.
 *
 * Wraps the entire navigation tree in a {@link StripeProvider} so that
 * Stripe payment sheets and Terminal SDK calls are available on every screen.
 *
 * Navigation structure:
 * - `(tabs)` -- Tab navigator (Storefront, Fundraising, Admin POS)
 * - `cart`   -- Modal-presented shopping cart screen
 *
 * @module mobile/app/_layout
 */

import { Stack } from 'expo-router';
import { StripeProvider } from '../lib/payments';

/**
 * Application root layout component.
 *
 * @returns The Expo Router Stack wrapped in the Stripe context provider.
 */
export default function RootLayout() {
  return (
    <StripeProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="cart" options={{ presentation: 'modal', title: 'Shopping Cart' }} />
        <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      </Stack>
    </StripeProvider>
  );
}
