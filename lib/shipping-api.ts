/**
 * Shipping API Client - EasyPost and Shippo integration
 * José Madrid Salsa E-commerce Platform
 *
 * @module lib/shipping-api
 */

import EasyPostClient from '@easypost/api'
import type { Rate } from '@easypost/api'

/**
 * Shipping provider configuration
 *
 * Lazy-evaluated to support hot reloading and testing.
 */
function getShippingConfig() {
  return {
    provider: process.env.SHIPPING_PROVIDER || 'easypost',
    apiKey: process.env.SHIPPING_API_KEY,
    testMode: process.env.SHIPPING_TEST_MODE === 'true',
  }
}

/**
 * EasyPost client singleton
 *
 * Creates and caches a configured EasyPost client instance.
 * Follows the same pattern as the Stripe integration.
 *
 * @returns Configured EasyPost client
 * @throws Error if SHIPPING_API_KEY is not set
 */
let easyPostClientInstance: InstanceType<typeof EasyPostClient> | null = null

function getEasyPostClient(): InstanceType<typeof EasyPostClient> {
  const config = getShippingConfig()

  if (!config.apiKey) {
    throw new Error(
      'SHIPPING_API_KEY environment variable is required for EasyPost integration'
    )
  }

  if (!easyPostClientInstance) {
    easyPostClientInstance = new EasyPostClient(config.apiKey, {
      timeout: 60000, // EasyPost recommended default timeout
    })
  }

  return easyPostClientInstance
}

/**
 * Address interface for shipping calculations
 */
export interface ShippingAddress {
  name?: string
  company?: string
  street1: string
  street2?: string
  city: string
  state: string
  zip: string
  country: string
  phone?: string
  email?: string
}

/**
 * Parcel/package dimensions and weight
 */
export interface Parcel {
  length: number // inches
  width: number // inches
  height: number // inches
  weight: number // ounces
}

/**
 * Shipment request parameters
 */
export interface ShipmentRequest {
  fromAddress: ShippingAddress
  toAddress: ShippingAddress
  parcel: Parcel
  reference?: string // Order ID or reference number
}

/**
 * Individual shipping rate option
 */
export interface ShippingRate {
  id: string // Rate ID from provider
  carrier: string // USPS, UPS, FedEx, etc.
  service: string // Priority Mail, Ground, Express, etc.
  rate: number // Cost in dollars
  currency: string // USD
  deliveryDays?: number // Estimated delivery days
  deliveryDate?: string // Estimated delivery date
  deliveryDateGuaranteed?: boolean
}

/**
 * Shipment rates response
 */
export interface ShipmentRates {
  rates: ShippingRate[]
  messages?: Array<{
    carrier?: string
    type: string
    message: string
  }>
}

/**
 * Shipping API client interface
 */
interface ShippingClient {
  provider: string
  testMode: boolean
  getRates(request: ShipmentRequest): Promise<ShipmentRates>
}

/**
 * Maps an EasyPost Rate object to our ShippingRate interface
 *
 * @param easyPostRate - Rate object from EasyPost API
 * @returns Normalized shipping rate
 */
function mapEasyPostRate(easyPostRate: Rate): ShippingRate {
  return {
    id: easyPostRate.id,
    carrier: easyPostRate.carrier || 'Unknown',
    service: easyPostRate.service || 'Standard',
    rate: parseFloat(easyPostRate.rate || '0'),
    currency: easyPostRate.currency || 'USD',
    deliveryDays: easyPostRate.delivery_days || undefined,
    deliveryDate: easyPostRate.delivery_date || undefined,
    deliveryDateGuaranteed: easyPostRate.delivery_date_guaranteed || false,
  }
}

/**
 * EasyPost client implementation
 *
 * Integrates with EasyPost API for real-time carrier rates.
 * Follows the adapter pattern from the Stripe integration.
 */
class EasyPostShippingClient implements ShippingClient {
  provider = 'easypost'
  testMode: boolean

  constructor(testMode: boolean) {
    this.testMode = testMode
  }

  async getRates(request: ShipmentRequest): Promise<ShipmentRates> {
    try {
      const client = getEasyPostClient()

      // Create shipment to get rates
      const shipment = await client.Shipment.create({
        from_address: {
          name: request.fromAddress.name,
          company: request.fromAddress.company,
          street1: request.fromAddress.street1,
          street2: request.fromAddress.street2,
          city: request.fromAddress.city,
          state: request.fromAddress.state,
          zip: request.fromAddress.zip,
          country: request.fromAddress.country,
          phone: request.fromAddress.phone,
          email: request.fromAddress.email,
        },
        to_address: {
          name: request.toAddress.name,
          company: request.toAddress.company,
          street1: request.toAddress.street1,
          street2: request.toAddress.street2,
          city: request.toAddress.city,
          state: request.toAddress.state,
          zip: request.toAddress.zip,
          country: request.toAddress.country,
          phone: request.toAddress.phone,
          email: request.toAddress.email,
        },
        parcel: {
          length: request.parcel.length,
          width: request.parcel.width,
          height: request.parcel.height,
          weight: request.parcel.weight,
        },
        reference: request.reference,
      })

      // Map EasyPost rates to our format
      const rates = (shipment.rates || []).map(mapEasyPostRate)

      // Sort by rate (lowest first)
      rates.sort((a, b) => a.rate - b.rate)

      const messages: ShipmentRates['messages'] = []

      if (this.testMode) {
        messages.push({
          type: 'info',
          message: 'Test mode - using EasyPost test API',
        })
      }

      // Add warning if no rates returned
      if (rates.length === 0) {
        messages.push({
          type: 'warning',
          message: 'No shipping rates available for this destination',
        })
      }

      return {
        rates,
        messages: messages.length > 0 ? messages : undefined,
      }
    } catch (error) {
      // Log error details
      console.error('[EasyPost] Error fetching rates:', error)

      // Return error message
      return {
        rates: [],
        messages: [
          {
            type: 'error',
            message:
              error instanceof Error
                ? `EasyPost API error: ${error.message}`
                : 'Failed to fetch shipping rates',
          },
        ],
      }
    }
  }
}

/**
 * Shippo client implementation
 */
class ShippoClient implements ShippingClient {
  provider = 'shippo'
  testMode: boolean
  private apiKey: string

  constructor(apiKey: string, testMode: boolean) {
    this.apiKey = apiKey
    this.testMode = testMode
  }

  async getRates(request: ShipmentRequest): Promise<ShipmentRates> {
    // Shippo API integration
    // For now, return mock data - will be implemented when Shippo SDK is added
    // TODO: Install shippo and implement real API calls

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Mock rates for development
    const mockRates: ShippingRate[] = [
      {
        id: 'rate_usps_first',
        carrier: 'USPS',
        service: 'First Class Package',
        rate: 5.99,
        currency: 'USD',
        deliveryDays: 3,
      },
      {
        id: 'rate_usps_priority',
        carrier: 'USPS',
        service: 'Priority Mail',
        rate: 9.49,
        currency: 'USD',
        deliveryDays: 2,
      },
      {
        id: 'rate_ups_ground',
        carrier: 'UPS',
        service: 'Ground',
        rate: 12.99,
        currency: 'USD',
        deliveryDays: 4,
      },
    ]

    return {
      rates: mockRates,
      messages: this.testMode
        ? [
            {
              type: 'info',
              message: 'Test mode - using mock rates',
            },
          ]
        : undefined,
    }
  }
}

/**
 * Singleton shipping client instance
 */
let shippingClient: ShippingClient | null = null

/**
 * Get shipping API client instance
 *
 * Follows singleton pattern from lib/stripe.ts
 * Supports both EasyPost and Shippo providers
 *
 * @returns Shipping client instance
 * @throws Error if API key is not configured
 */
export const getShippingClient = (): ShippingClient => {
  const config = getShippingConfig()

  if (!config.apiKey) {
    throw new Error(
      'Shipping API key is not configured. Please set SHIPPING_API_KEY in your environment.'
    )
  }

  if (!shippingClient) {
    // Create client based on provider
    switch (config.provider.toLowerCase()) {
      case 'easypost':
        shippingClient = new EasyPostShippingClient(config.testMode)
        break
      case 'shippo':
        console.warn(
          '[Shipping API] Shippo provider selected but not yet integrated. ' +
            'Install shippo SDK to enable Shippo rates.'
        )
        shippingClient = new ShippoClient(config.apiKey, config.testMode)
        break
      default:
        throw new Error(
          `Unsupported shipping provider: ${config.provider}. Supported providers: easypost, shippo`
        )
    }
  }

  return shippingClient
}

/**
 * Get shipping rates for a shipment
 *
 * High-level helper function that handles errors gracefully
 *
 * @param request Shipment request parameters
 * @returns Shipping rates or empty array on error
 */
export async function getShippingRates(
  request: ShipmentRequest
): Promise<ShipmentRates> {
  try {
    const client = getShippingClient()
    const rates = await client.getRates(request)
    return rates
  } catch (error) {
    console.error('[Shipping API] Error fetching rates:', error)

    if (error instanceof Error) {
      console.error('[Shipping API] Error details:', error.message)
    }

    // Return empty rates on error - fallback logic should handle this
    return {
      rates: [],
      messages: [
        {
          type: 'error',
          message: 'Unable to fetch real-time shipping rates. Please try again.',
        },
      ],
    }
  }
}

/**
 * Validate shipping API configuration
 *
 * Call this during app startup to ensure shipping provider is properly configured
 */
export async function validateShippingConfiguration(): Promise<{
  configured: boolean
  provider?: string
  testMode?: boolean
  error?: string
}> {
  try {
    const config = getShippingConfig()
    if (!config.apiKey) {
      return {
        configured: false,
        error: 'SHIPPING_API_KEY is not set',
      }
    }

    const client = getShippingClient()

    // Try a test rate fetch
    const testRequest: ShipmentRequest = {
      fromAddress: {
        street1: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94111',
        country: 'US',
      },
      toAddress: {
        street1: '456 Oak Ave',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
        country: 'US',
      },
      parcel: {
        length: 10,
        width: 8,
        height: 4,
        weight: 16, // 1 lb in ounces
      },
    }

    const result = await client.getRates(testRequest)

    if (result.rates.length > 0) {
      return {
        configured: true,
        provider: client.provider,
        testMode: client.testMode,
      }
    } else {
      return {
        configured: false,
        error: 'No rates returned from provider',
      }
    }
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
