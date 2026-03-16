/**
 * Shipping API Client - EasyPost and Shippo integration
 * José Madrid Salsa E-commerce Platform
 */

/**
 * Shipping provider configuration
 */
const shippingProvider = process.env.SHIPPING_PROVIDER || 'easypost'
const shippingApiKey = process.env.SHIPPING_API_KEY
const shippingTestMode = process.env.SHIPPING_TEST_MODE === 'true'

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
 * EasyPost client implementation
 */
class EasyPostClient implements ShippingClient {
  provider = 'easypost'
  testMode: boolean
  private apiKey: string

  constructor(apiKey: string, testMode: boolean) {
    this.apiKey = apiKey
    this.testMode = testMode
  }

  async getRates(request: ShipmentRequest): Promise<ShipmentRates> {
    // EasyPost API integration
    // For now, return mock data - will be implemented when EasyPost SDK is added
    // TODO: Install @easypost/api and implement real API calls

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Mock rates for development
    const mockRates: ShippingRate[] = [
      {
        id: 'rate_usps_ground',
        carrier: 'USPS',
        service: 'Ground Advantage',
        rate: 6.99,
        currency: 'USD',
        deliveryDays: 3,
      },
      {
        id: 'rate_usps_priority',
        carrier: 'USPS',
        service: 'Priority Mail',
        rate: 9.99,
        currency: 'USD',
        deliveryDays: 2,
      },
      {
        id: 'rate_usps_express',
        carrier: 'USPS',
        service: 'Priority Mail Express',
        rate: 24.99,
        currency: 'USD',
        deliveryDays: 1,
        deliveryDateGuaranteed: true,
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
  if (!shippingApiKey) {
    throw new Error(
      'Shipping API key is not configured. Please set SHIPPING_API_KEY in your environment.'
    )
  }

  if (!shippingClient) {
    // Create client based on provider
    switch (shippingProvider.toLowerCase()) {
      case 'easypost':
        shippingClient = new EasyPostClient(shippingApiKey, shippingTestMode)
        break
      case 'shippo':
        shippingClient = new ShippoClient(shippingApiKey, shippingTestMode)
        break
      default:
        throw new Error(
          `Unsupported shipping provider: ${shippingProvider}. Supported providers: easypost, shippo`
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
    if (!shippingApiKey) {
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
