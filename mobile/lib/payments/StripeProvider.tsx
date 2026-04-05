/**
 * Stripe provider wrapper that initializes the Stripe SDK for the entire app.
 * Wrap the root layout with this component.
 *
 * Enables:
 * - Card payments via PaymentSheet
 * - Apple Pay (iOS)
 * - Google Pay (Android, future)
 */

import { ReactElement } from 'react';
import { StripeProvider as StripeNativeProvider } from '@stripe/stripe-react-native';
import {
  STRIPE_PUBLISHABLE_KEY,
  APPLE_PAY_MERCHANT_ID,
} from './stripe-config';

interface Props {
  children: ReactElement | ReactElement[];
}

export function StripeProvider({ children }: Props) {
  return (
    <StripeNativeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier={APPLE_PAY_MERCHANT_ID}
      urlScheme="josemadridsalsa"
    >
      {children}
    </StripeNativeProvider>
  );
}
