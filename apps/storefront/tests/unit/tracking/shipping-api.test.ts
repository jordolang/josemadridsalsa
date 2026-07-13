import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ShipmentRequest } from '@/lib/shipping-api'

// Store original environment variables
const originalEnv = { ...process.env }

// Mock implementations
const mockShipmentCreate = vi.fn()
const mockShipmentRetrieve = vi.fn()
const mockShipmentBuy = vi.fn()
const mockTrackerCreate = vi.fn()

// Mock EasyPost SDK
vi.mock('@easypost/api', () => {
  class MockEasyPostClient {
    Shipment: any
    Tracker: any

    constructor(_apiKey: string, _config: any) {
      this.Shipment = {
        create: mockShipmentCreate,
        retrieve: mockShipmentRetrieve,
        buy: mockShipmentBuy,
      }
      this.Tracker = {
        create: mockTrackerCreate,
      }
    }
  }

  return { default: MockEasyPostClient }
})

describe('Shipping API - EasyPost Integration', () => {
  beforeEach(() => {
    // Clear module cache to reset the singleton
    vi.resetModules()
    // Clear all mocks
    vi.clearAllMocks()
    mockShipmentCreate.mockClear()
    mockShipmentRetrieve.mockClear()
    mockShipmentBuy.mockClear()
    mockTrackerCreate.mockClear()
    // Reset environment variables
    process.env = { ...originalEnv }
    process.env.SHIPPING_API_KEY = 'test_api_key'
    process.env.EASYPOST_WEBHOOK_SECRET = 'test_webhook_secret'
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('createShipment', () => {
    it('creates shipment with valid addresses and parcel', async () => {
      const mockShipmentResponse = {
        id: 'shp_test123',
        rates: [
          {
            id: 'rate_test1',
            carrier: 'USPS',
            service: 'Priority',
            rate: '10.50',
            currency: 'USD',
          },
          {
            id: 'rate_test2',
            carrier: 'UPS',
            service: 'Ground',
            rate: '12.00',
            currency: 'USD',
          },
        ],
      }

      mockShipmentCreate.mockResolvedValue(mockShipmentResponse)

      const { createShipment } = await import('@/lib/shipping-api')

      const request: ShipmentRequest = {
        fromAddress: {
          name: 'José Madrid Salsa',
          street1: '123 Salsa St',
          city: 'Miami',
          state: 'FL',
          zip: '33101',
          country: 'US',
          phone: '305-555-1234',
        },
        toAddress: {
          name: 'John Doe',
          street1: '456 Customer Ave',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          country: 'US',
          phone: '212-555-5678',
        },
        parcel: {
          weight: 2.5,
          length: 10,
          width: 8,
          height: 6,
        },
      }

      const result = await createShipment(request)

      expect(result).toBeDefined()
      expect(result.id).toBe('shp_test123')
      expect(result.rates).toHaveLength(2)
      expect(result.rates[0].carrier).toBe('USPS')
      expect(result.rates[0].rate).toBe(10.50)

      expect(mockShipmentCreate).toHaveBeenCalledWith({
        from_address: expect.objectContaining({
          name: 'José Madrid Salsa',
          street1: '123 Salsa St',
          city: 'Miami',
          state: 'FL',
          zip: '33101',
        }),
        to_address: expect.objectContaining({
          name: 'John Doe',
          street1: '456 Customer Ave',
        }),
        parcel: expect.objectContaining({
          weight: 2.5,
          length: 10,
          width: 8,
          height: 6,
        }),
      })
    })

    it('throws error when API key is missing', async () => {
      delete process.env.SHIPPING_API_KEY

      const { createShipment } = await import('@/lib/shipping-api')

      const request: ShipmentRequest = {
        fromAddress: {
          name: 'Test',
          street1: '123 St',
          city: 'City',
          state: 'ST',
          zip: '12345',
          country: 'US',
        },
        toAddress: {
          name: 'Test',
          street1: '456 St',
          city: 'City',
          state: 'ST',
          zip: '54321',
          country: 'US',
        },
        parcel: {
          weight: 1,
          length: 5,
          width: 5,
          height: 5,
        },
      }

      await expect(createShipment(request)).rejects.toThrow(
        'Shipping API key is not configured'
      )
    })

    it('handles EasyPost API errors gracefully', async () => {
      mockShipmentCreate.mockRejectedValue(new Error('Invalid address'))

      const { createShipment } = await import('@/lib/shipping-api')

      const request: ShipmentRequest = {
        fromAddress: {
          name: 'Test',
          street1: '123 St',
          city: 'City',
          state: 'ST',
          zip: '12345',
          country: 'US',
        },
        toAddress: {
          name: 'Test',
          street1: 'Invalid',
          city: 'City',
          state: 'ST',
          zip: '00000',
          country: 'US',
        },
        parcel: {
          weight: 1,
          length: 5,
          width: 5,
          height: 5,
        },
      }

      await expect(createShipment(request)).rejects.toThrow('Invalid address')
    })
  })

  describe('buyShipmentLabel', () => {
    it('purchases label with selected rate', async () => {
      mockShipmentBuy.mockResolvedValue({
        id: 'shp_test123',
        tracking_code: 'TRACK123456',
        postage_label: {
          label_url: 'https://easypost.com/labels/test.pdf',
        },
        tracker: {
          id: 'trk_test',
          public_url: 'https://track.easypost.com/TRACK123456',
        },
        selected_rate: {
          carrier: 'USPS',
          service: 'Priority',
          rate: '10.50',
          currency: 'USD',
        },
        status: 'purchased',
        created_at: '2026-06-19T10:00:00Z',
      })

      const { buyShipmentLabel } = await import('@/lib/shipping-api')

      const result = await buyShipmentLabel('shp_test123', 'rate_test1')

      expect(result).toBeDefined()
      expect(result.id).toBe('shp_test123')
      expect(result.trackingCode).toBe('TRACK123456')
      expect(result.labelUrl).toBe('https://easypost.com/labels/test.pdf')
      expect(result.carrier).toBe('USPS')

      // EasyPost v8 service method: buy(shipmentId, rateId)
      expect(mockShipmentBuy).toHaveBeenCalledWith('shp_test123', 'rate_test1')
    })

    it('throws error when label URL is not available', async () => {
      mockShipmentBuy.mockResolvedValue({
        id: 'shp_test123',
        tracking_code: 'TRACK123456',
        postage_label: null, // No label available
      })

      const { buyShipmentLabel } = await import('@/lib/shipping-api')

      await expect(
        buyShipmentLabel('shp_test123', 'rate_test1')
      ).rejects.toThrow('Label URL not available after purchase')
    })
  })

  describe('getTrackingDetails', () => {
    it('retrieves tracking details for valid tracking code', async () => {
      const mockTracker = {
        id: 'trk_test',
        tracking_code: 'TRACK123456',
        carrier: 'USPS',
        status: 'in_transit',
        est_delivery_date: '2026-06-25',
        public_url: 'https://track.easypost.com/TRACK123456',
        tracking_details: [
          {
            status: 'pre_transit',
            message: 'Shipping label created',
            datetime: '2026-06-19T10:00:00Z',
            tracking_location: {
              city: 'Miami',
              state: 'FL',
            },
          },
          {
            status: 'in_transit',
            message: 'Package accepted at facility',
            datetime: '2026-06-19T14:00:00Z',
            tracking_location: {
              city: 'Jacksonville',
              state: 'FL',
            },
          },
        ],
      }

      mockTrackerCreate.mockResolvedValue(mockTracker)

      const { getTrackingDetails } = await import('@/lib/shipping-api')

      const result = await getTrackingDetails('TRACK123456', 'USPS')

      expect(result).toBeDefined()
      expect(result.trackingCode).toBe('TRACK123456')
      expect(result.status).toBe('in_transit')
      expect(result.carrier).toBe('USPS')
      expect(result.events).toHaveLength(2)
      expect(result.events[0].status).toBe('in_transit') // Sorted newest first
      expect(result.events[1].status).toBe('pre_transit')

      expect(mockTrackerCreate).toHaveBeenCalledWith({
        tracking_code: 'TRACK123456',
        carrier: 'USPS',
      })
    })

    it('handles tracking code not found', async () => {
      mockTrackerCreate.mockRejectedValue(
        new Error('Tracking code not found')
      )

      const { getTrackingDetails } = await import('@/lib/shipping-api')

      await expect(
        getTrackingDetails('INVALID', 'USPS')
      ).rejects.toThrow('Tracking code not found')
    })
  })
})
