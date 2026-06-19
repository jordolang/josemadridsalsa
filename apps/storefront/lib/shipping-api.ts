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
 * Created shipment response
 */
export interface CreatedShipment {
  id: string // EasyPost shipment ID
  rates: ShippingRate[]
  fromAddress: ShippingAddress
  toAddress: ShippingAddress
  parcel: Parcel
  reference?: string
}

/**
 * Purchased shipping label response
 */
export interface ShippingLabel {
  id: string // EasyPost shipment ID
  trackingCode: string
  trackingUrl?: string
  labelUrl: string
  carrier: string
  service: string
  rate: number
  currency: string
  status: string
  createdAt: Date
}

/**
 * Tracking event from carrier
 */
export interface TrackingEvent {
  status: string
  message: string
  city?: string
  state?: string
  country?: string
  zip?: string
  timestamp: Date
}

/**
 * Tracking details response
 */
export interface TrackingDetails {
  trackingCode: string
  carrier: string
  status: string
  estimatedDeliveryDate?: Date
  events: TrackingEvent[]
  signedBy?: string
  weight?: number
}

/**
 * Shipping API client interface
 */
interface ShippingClient {
  provider: string
  testMode: boolean
  getRates(request: ShipmentRequest): Promise<ShipmentRates>
  createShipment(request: ShipmentRequest): Promise<CreatedShipment>
  buyShipmentLabel(shipmentId: string, rateId: string): Promise<ShippingLabel>
  getTrackingDetails(trackingCode: string, carrier?: string): Promise<TrackingDetails>
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

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    try {
      const client = getEasyPostClient()

      // Create shipment
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

      // Map rates
      const rates = (shipment.rates || []).map(mapEasyPostRate)
      rates.sort((a, b) => a.rate - b.rate)

      return {
        id: shipment.id,
        rates,
        fromAddress: request.fromAddress,
        toAddress: request.toAddress,
        parcel: request.parcel,
        reference: request.reference,
      }
    } catch (error) {
      console.error('[EasyPost] Error creating shipment:', error)
      throw new Error(
        error instanceof Error
          ? `Failed to create shipment: ${error.message}`
          : 'Failed to create shipment'
      )
    }
  }

  async buyShipmentLabel(
    shipmentId: string,
    rateId: string
  ): Promise<ShippingLabel> {
    try {
      const client = getEasyPostClient()

      // Buy shipment with selected rate
      const shipment = await client.Shipment.retrieve(shipmentId)
      const boughtShipment = await shipment.buy(rateId)

      // Get postage label
      const labelUrl = boughtShipment.postage_label?.label_url
      if (!labelUrl) {
        throw new Error('Label URL not available after purchase')
      }

      // Get tracking info
      const trackingCode = boughtShipment.tracking_code || ''
      const trackingUrl = boughtShipment.tracker?.public_url

      // Get selected rate info
      const selectedRate = boughtShipment.selected_rate
      if (!selectedRate) {
        throw new Error('Selected rate not available after purchase')
      }

      return {
        id: boughtShipment.id,
        trackingCode,
        trackingUrl,
        labelUrl,
        carrier: selectedRate.carrier || 'Unknown',
        service: selectedRate.service || 'Standard',
        rate: parseFloat(selectedRate.rate || '0'),
        currency: selectedRate.currency || 'USD',
        status: boughtShipment.status || 'purchased',
        createdAt: new Date(boughtShipment.created_at || Date.now()),
      }
    } catch (error) {
      console.error('[EasyPost] Error buying shipment label:', error)
      throw new Error(
        error instanceof Error
          ? `Failed to purchase label: ${error.message}`
          : 'Failed to purchase label'
      )
    }
  }

  async getTrackingDetails(
    trackingCode: string,
    carrier?: string
  ): Promise<TrackingDetails> {
    try {
      const client = getEasyPostClient()

      // Create or retrieve tracker
      const tracker = await client.Tracker.create({
        tracking_code: trackingCode,
        carrier: carrier,
      })

      // Map tracking events
      const events: TrackingEvent[] = (tracker.tracking_details || []).map(
        (detail) => ({
          status: detail.status || 'unknown',
          message: detail.message || '',
          city: detail.tracking_location?.city,
          state: detail.tracking_location?.state,
          country: detail.tracking_location?.country,
          zip: detail.tracking_location?.zip,
          timestamp: new Date(detail.datetime || Date.now()),
        })
      )

      // Sort events by timestamp (newest first)
      events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      return {
        trackingCode: tracker.tracking_code || trackingCode,
        carrier: tracker.carrier || carrier || 'Unknown',
        status: tracker.status || 'unknown',
        estimatedDeliveryDate: tracker.est_delivery_date
          ? new Date(tracker.est_delivery_date)
          : undefined,
        events,
        signedBy: tracker.signed_by,
        weight: tracker.weight,
      }
    } catch (error) {
      console.error('[EasyPost] Error fetching tracking details:', error)
      throw new Error(
        error instanceof Error
          ? `Failed to get tracking details: ${error.message}`
          : 'Failed to get tracking details'
      )
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

  async createShipment(request: ShipmentRequest): Promise<CreatedShipment> {
    // Shippo API integration
    // TODO: Install shippo and implement real API calls
    throw new Error('Shippo createShipment not yet implemented')
  }

  async buyShipmentLabel(
    shipmentId: string,
    rateId: string
  ): Promise<ShippingLabel> {
    // Shippo API integration
    // TODO: Install shippo and implement real API calls
    throw new Error('Shippo buyShipmentLabel not yet implemented')
  }

  async getTrackingDetails(
    trackingCode: string,
    carrier?: string
  ): Promise<TrackingDetails> {
    // Shippo API integration
    // TODO: Install shippo and implement real API calls
    throw new Error('Shippo getTrackingDetails not yet implemented')
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
 * Create a shipment and get available rates
 *
 * High-level helper function that handles errors gracefully
 *
 * @param request Shipment request parameters
 * @returns Created shipment with available rates
 */
export async function createShipment(
  request: ShipmentRequest
): Promise<CreatedShipment> {
  try {
    const client = getShippingClient()
    const shipment = await client.createShipment(request)
    return shipment
  } catch (error) {
    console.error('[Shipping API] Error creating shipment:', error)

    if (error instanceof Error) {
      console.error('[Shipping API] Error details:', error.message)
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to create shipment. Please try again.'
    )
  }
}

/**
 * Purchase a shipping label for a shipment
 *
 * High-level helper function that handles errors gracefully
 *
 * @param shipmentId EasyPost shipment ID
 * @param rateId Rate ID to purchase
 * @returns Purchased shipping label with tracking info
 */
export async function buyShipmentLabel(
  shipmentId: string,
  rateId: string
): Promise<ShippingLabel> {
  try {
    const client = getShippingClient()
    const label = await client.buyShipmentLabel(shipmentId, rateId)
    return label
  } catch (error) {
    console.error('[Shipping API] Error buying label:', error)

    if (error instanceof Error) {
      console.error('[Shipping API] Error details:', error.message)
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to purchase shipping label. Please try again.'
    )
  }
}

/**
 * Get tracking details for a tracking code
 *
 * High-level helper function that handles errors gracefully
 *
 * @param trackingCode Tracking code to look up
 * @param carrier Optional carrier name for faster lookup
 * @returns Tracking details with event history
 */
export async function getTrackingDetails(
  trackingCode: string,
  carrier?: string
): Promise<TrackingDetails> {
  try {
    const client = getShippingClient()
    const tracking = await client.getTrackingDetails(trackingCode, carrier)
    return tracking
  } catch (error) {
    console.error('[Shipping API] Error fetching tracking details:', error)

    if (error instanceof Error) {
      console.error('[Shipping API] Error details:', error.message)
    }

    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to get tracking details. Please try again.'
    )
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
