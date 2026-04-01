/**
 * Payment Provider Registry - Routes payment requests to the correct adapter
 * Jose Madrid Salsa E-commerce Platform
 *
 * Maintains a singleton map of registered payment provider adapters and
 * resolves the correct adapter based on provider name or payment method type.
 * @module lib/payments/registry
 */

import type {
  PaymentProvider,
  PaymentMethodType,
  PaymentProviderAdapter,
} from './types'

/**
 * Maps each payment method type to its provider.
 * Used to route payment requests to the correct adapter.
 */
export const METHOD_PROVIDER_MAP: Record<PaymentMethodType, PaymentProvider> = {
  CARD: 'STRIPE',
  ACH: 'STRIPE',
  APPLE_PAY: 'STRIPE',
  GOOGLE_PAY: 'STRIPE',
  PAYPAL: 'PAYPAL',
  SQUARE_TERMINAL: 'SQUARE',
}

/** Singleton registry of payment provider adapters, keyed by provider name. */
const adapters = new Map<PaymentProvider, PaymentProviderAdapter>()

/**
 * Registers a payment provider adapter in the global registry.
 * Called during app initialization for each available provider.
 *
 * @param adapter - The adapter instance to register
 */
export function registerProvider(adapter: PaymentProviderAdapter): void {
  adapters.set(adapter.provider, adapter)
}

/**
 * Retrieves a registered adapter by provider name.
 *
 * @param provider - The provider to look up
 * @returns The registered adapter
 * @throws {Error} If the provider is not registered
 */
export function getProvider(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = adapters.get(provider)
  if (!adapter) {
    throw new Error(
      `Payment provider "${provider}" is not registered. ` +
        `Available providers: ${[...adapters.keys()].join(', ') || 'none'}`
    )
  }
  return adapter
}

/**
 * Resolves the correct adapter for a given payment method type
 * using the METHOD_PROVIDER_MAP lookup.
 *
 * @param methodType - The payment method type (e.g., CARD, PAYPAL)
 * @returns The adapter that handles the given method type
 * @throws {Error} If the mapped provider is not registered
 */
export function getProviderForMethod(
  methodType: PaymentMethodType
): PaymentProviderAdapter {
  const provider = METHOD_PROVIDER_MAP[methodType]
  return getProvider(provider)
}

/**
 * Returns the list of currently registered provider names.
 *
 * @returns Array of registered provider identifiers
 */
export function getRegisteredProviders(): PaymentProvider[] {
  return [...adapters.keys()]
}
