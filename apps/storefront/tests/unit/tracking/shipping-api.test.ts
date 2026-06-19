import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createShipment, buyShipmentLabel, getTrackingDetails } from '@/lib/shipping-api'
import type { ShipmentRequest } from '@/lib/shipping-api'

// Mock EasyPost client
const mockCreate = vi.fn()
const mockRetrieve = vi.fn()
const mockBuy = vi.fn()
const mockTrackerCreate = vi.fn()

// Mock the shipping-api module directly since EasyPost client is internal
vi.mock('@/lib/shipping-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shipping-api')>('@/lib/shipping-api')
  return {
    ...actual,
    createShipment: vi.fn(),
    buyShipmentLabel: vi.fn(),
    getTrackingDetails: vi.fn(),
  }
})

describe('Shipping API - EasyPost Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SHIPPING_API_KEY = 'test_api_key'
    process.env.EASYPOST_WEBHOOK_SECRET = 'test_webhook_secret'
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
          },
          {
            id: 'rate_test2',
            carrier: 'UPS',
            service: 'Ground',
            rate: '12.00',
          },
        ],
      }

      mockCreate.mockResolvedValue(mockShipmentResponse)

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

      expect(result).toEqual({
        shipmentId: 'shp_test123',
        rates: [
          {
            id: 'rate_test1',
            carrier: 'USPS',
            service: 'Priority',
            price: '10.50',
          },
          {
            id: 'rate_test2',
            carrier: 'UPS',
            service: 'Ground',
            price: '12.00',
          },
        ],
      })

      expect(mockCreate).toHaveBeenCalledWith({
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
      process.env.SHIPPING_API_KEY = 'test_api_key' // Ensure key is set
      mockCreate.mockRejectedValue(new Error('Invalid address'))

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
      const mockShipment = {
        id: 'shp_test123',
        buy: mockBuy,
      }

      const mockBoughtShipment = {
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
        },
      }

      mockRetrieve.mockResolvedValue(mockShipment)
      mockBuy.mockResolvedValue(mockBoughtShipment)

      const result = await buyShipmentLabel('shp_test123', 'rate_test1')

      expect(result).toEqual({
        shipmentId: 'shp_test123',
        trackingCode: 'TRACK123456',
        labelUrl: 'https://easypost.com/labels/test.pdf',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        carrier: 'USPS',
        service: 'Priority',
      })

      expect(mockRetrieve).toHaveBeenCalledWith('shp_test123')
      expect(mockBuy).toHaveBeenCalledWith('rate_test1')
    })

    it('throws error when label URL is not available', async () => {
      const mockShipment = {
        id: 'shp_test123',
        buy: mockBuy,
      }

      const mockBoughtShipment = {
        id: 'shp_test123',
        tracking_code: 'TRACK123456',
        postage_label: null, // No label available
      }

      mockRetrieve.mockResolvedValue(mockShipment)
      mockBuy.mockResolvedValue(mockBoughtShipment)

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

      const result = await getTrackingDetails('TRACK123456', 'USPS')

      expect(result).toEqual({
        trackingCode: 'TRACK123456',
        status: 'in_transit',
        estimatedDelivery: '2026-06-25',
        trackingUrl: 'https://track.easypost.com/TRACK123456',
        events: [
          {
            status: 'pre_transit',
            message: 'Shipping label created',
            timestamp: '2026-06-19T10:00:00Z',
            location: 'Miami, FL',
          },
          {
            status: 'in_transit',
            message: 'Package accepted at facility',
            timestamp: '2026-06-19T14:00:00Z',
            location: 'Jacksonville, FL',
          },
        ],
      })

      expect(mockTrackerCreate).toHaveBeenCalledWith({
        tracking_code: 'TRACK123456',
        carrier: 'USPS',
      })
    })

    it('handles tracking code not found', async () => {
      mockTrackerCreate.mockRejectedValue(
        new Error('Tracking code not found')
      )

      await expect(
        getTrackingDetails('INVALID', 'USPS')
      ).rejects.toThrow('Tracking code not found')
    })
  })
})
