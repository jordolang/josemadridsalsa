import { http, HttpResponse } from 'msw'

/**
 * MSW Request Handlers for External API Mocking
 *
 * These handlers mock external services called by the application:
 * - Stripe API (payment processing, tax calculation)
 * - Shopify Admin API (order sync)
 * - Google Places API (location data)
 * - Google Maps API (geocoding, images)
 */

// Helper to get Shopify domain from request
const getShopifyDomain = (url: URL) => {
  const match = url.hostname.match(/^(.+?)\.myshopify\.com$/)
  return match ? match[1] : 'test-store'
}

export const handlers = [
  // ============================================================
  // Stripe API Handlers
  // ============================================================

  // Create Payment Intent
  http.post('https://api.stripe.com/v1/payment_intents', async () => {
    return HttpResponse.json({
      id: 'pi_test_123456789',
      object: 'payment_intent',
      amount: 2000,
      currency: 'usd',
      status: 'requires_payment_method',
      client_secret: 'pi_test_123456789_secret_test',
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      payment_method_types: ['card'],
    })
  }),

  // Retrieve Payment Intent
  http.get('https://api.stripe.com/v1/payment_intents/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      object: 'payment_intent',
      amount: 2000,
      currency: 'usd',
      status: 'succeeded',
      client_secret: `${params.id}_secret_test`,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      payment_method_types: ['card'],
    })
  }),

  // Confirm Payment Intent
  http.post('https://api.stripe.com/v1/payment_intents/:id/confirm', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      object: 'payment_intent',
      amount: 2000,
      currency: 'usd',
      status: 'succeeded',
      client_secret: `${params.id}_secret_test`,
      created: Math.floor(Date.now() / 1000),
      livemode: false,
      payment_method_types: ['card'],
    })
  }),

  // Create Tax Calculation
  http.post('https://api.stripe.com/v1/tax/calculations', async () => {
    return HttpResponse.json({
      id: 'taxcalc_test_123',
      object: 'tax.calculation',
      amount_total: 2000,
      currency: 'usd',
      customer_details: {
        address: {
          country: 'US',
          state: 'OR',
          postal_code: '97201',
        },
        address_source: 'shipping',
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      line_items: {
        object: 'list',
        data: [],
        has_more: false,
        url: '/v1/tax/calculations/taxcalc_test_123/line_items',
      },
      livemode: false,
      shipping_cost: null,
      tax_amount_exclusive: 160,
      tax_amount_inclusive: 0,
      tax_breakdown: [
        {
          amount: 160,
          inclusive: false,
          tax_rate_details: {
            country: 'US',
            percentage_decimal: '8.0',
            state: 'OR',
            tax_type: 'sales_tax',
          },
        },
      ],
      tax_date: Math.floor(Date.now() / 1000),
    })
  }),

  // Create Refund
  http.post('https://api.stripe.com/v1/refunds', async () => {
    return HttpResponse.json({
      id: 're_test_123456789',
      object: 'refund',
      amount: 2000,
      charge: 'ch_test_123',
      currency: 'usd',
      status: 'succeeded',
      created: Math.floor(Date.now() / 1000),
      reason: null,
    })
  }),

  // ============================================================
  // Shopify Admin API Handlers
  // ============================================================

  // Create Order
  http.post('https://:domain.myshopify.com/admin/api/:version/orders.json', async ({ request, params }) => {
    const body = await request.json()
    const domain = getShopifyDomain(new URL(request.url))

    return HttpResponse.json({
      order: {
        id: Math.floor(Math.random() * 1000000000),
        name: `#${Math.floor(Math.random() * 10000)}`,
        order_number: Math.floor(Math.random() * 10000),
        admin_graphql_api_id: `gid://shopify/Order/${Math.floor(Math.random() * 1000000000)}`,
        email: (body as any)?.order?.email || 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        financial_status: (body as any)?.order?.financial_status || 'paid',
        fulfillment_status: null,
        cancelled_at: null,
        closed_at: null,
        currency: 'USD',
        total_price: '20.00',
        subtotal_price: '18.00',
        total_tax: '2.00',
        tags: (body as any)?.order?.tags || '',
        note: (body as any)?.order?.note || null,
        note_attributes: (body as any)?.order?.note_attributes || [],
        line_items: (body as any)?.order?.line_items || [],
      },
    })
  }),

  // Cancel Order
  http.post('https://:domain.myshopify.com/admin/api/:version/orders/:id/cancel.json', ({ params }) => {
    return HttpResponse.json({
      order: {
        id: params.id,
        cancelled_at: new Date().toISOString(),
        financial_status: 'voided',
      },
    })
  }),

  // Get Order
  http.get('https://:domain.myshopify.com/admin/api/:version/orders/:id.json', ({ params }) => {
    return HttpResponse.json({
      order: {
        id: params.id,
        name: '#1001',
        order_number: 1001,
        admin_graphql_api_id: `gid://shopify/Order/${params.id}`,
        financial_status: 'paid',
        fulfillment_status: null,
        cancelled_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    })
  }),

  // ============================================================
  // Google Places API Handlers
  // ============================================================

  // Search Nearby Places
  http.post('https://places.googleapis.com/v1/places:searchNearby', async () => {
    return HttpResponse.json({
      places: [
        {
          id: 'place_test_1',
          displayName: {
            text: 'Test Location',
            languageCode: 'en',
          },
          formattedAddress: '123 Test St, Portland, OR 97201',
          location: {
            latitude: 45.5152,
            longitude: -122.6784,
          },
          rating: 4.5,
          userRatingCount: 100,
        },
      ],
    })
  }),

  // Get Place Details
  http.get('https://places.googleapis.com/v1/places/:placeId', ({ params }) => {
    return HttpResponse.json({
      id: params.placeId,
      displayName: {
        text: 'Test Location',
        languageCode: 'en',
      },
      formattedAddress: '123 Test St, Portland, OR 97201',
      location: {
        latitude: 45.5152,
        longitude: -122.6784,
      },
      rating: 4.5,
      userRatingCount: 100,
      websiteUri: 'https://example.com',
      regularOpeningHours: {
        openNow: true,
        weekdayDescriptions: [
          'Monday: 9:00 AM – 5:00 PM',
          'Tuesday: 9:00 AM – 5:00 PM',
          'Wednesday: 9:00 AM – 5:00 PM',
          'Thursday: 9:00 AM – 5:00 PM',
          'Friday: 9:00 AM – 5:00 PM',
          'Saturday: Closed',
          'Sunday: Closed',
        ],
      },
    })
  }),

  // ============================================================
  // Google Maps API Handlers
  // ============================================================

  // Geocoding API
  http.get('https://maps.googleapis.com/maps/api/geocode/json', ({ request }) => {
    const url = new URL(request.url)
    const address = url.searchParams.get('address')

    return HttpResponse.json({
      results: [
        {
          address_components: [
            {
              long_name: 'Portland',
              short_name: 'Portland',
              types: ['locality', 'political'],
            },
            {
              long_name: 'Oregon',
              short_name: 'OR',
              types: ['administrative_area_level_1', 'political'],
            },
            {
              long_name: 'United States',
              short_name: 'US',
              types: ['country', 'political'],
            },
          ],
          formatted_address: address || '123 Test St, Portland, OR 97201, USA',
          geometry: {
            location: {
              lat: 45.5152,
              lng: -122.6784,
            },
            location_type: 'APPROXIMATE',
            viewport: {
              northeast: {
                lat: 45.6152,
                lng: -122.5784,
              },
              southwest: {
                lat: 45.4152,
                lng: -122.7784,
              },
            },
          },
          place_id: 'ChIJTest123',
          types: ['street_address'],
        },
      ],
      status: 'OK',
    })
  }),

  // Street View Static API
  http.get('https://maps.googleapis.com/maps/api/streetview', () => {
    // Return a 1x1 transparent PNG
    const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const buffer = Buffer.from(base64PNG, 'base64')

    return new HttpResponse(buffer, {
      headers: {
        'Content-Type': 'image/png',
      },
    })
  }),

  // Places Photo API
  http.get('https://maps.googleapis.com/maps/api/place/photo', () => {
    // Return a 1x1 transparent PNG
    const base64PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const buffer = Buffer.from(base64PNG, 'base64')

    return new HttpResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
      },
    })
  }),
]
