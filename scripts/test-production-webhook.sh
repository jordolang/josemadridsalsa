#!/bin/bash

# Test Production Shopify Webhook
# This script sends a test webhook to your production endpoint

WEBHOOK_URL="https://josemadrid.net/api/webhooks/shopify"
WEBHOOK_SECRET="${SHOPIFY_WEBHOOK_SECRET:-be572098d22d2a3490b9de2cee309a2d1b65fd3bfa54655fa2f712528149417a}"

# Test payload
PAYLOAD='{
  "id": 123456789,
  "name": "#TEST1001",
  "order_number": 1001,
  "financial_status": "paid",
  "fulfillment_status": null,
  "cancelled_at": null,
  "closed_at": null,
  "updated_at": "2025-11-27T12:25:00Z",
  "note_attributes": [
    {"name": "orderNumber", "value": "ORD-TEST-001"}
  ],
  "fulfillments": []
}'

# Generate HMAC signature
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -binary | base64)

echo "🧪 Testing Production Webhook"
echo "══════════════════════════════════"
echo "URL: $WEBHOOK_URL"
echo "Topic: orders/paid"
echo "HMAC: ${HMAC:0:20}..."
echo ""

# Send request
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Topic: orders/paid" \
  -H "X-Shopify-Hmac-Sha256: $HMAC" \
  -H "X-Shopify-Shop-Domain: test-store.myshopify.com" \
  -H "X-Shopify-API-Version: 2024-10" \
  -d "$PAYLOAD")

# Parse response
HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS\:.*//g')
HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

echo "Response:"
echo "Status: $HTTP_STATUS"
echo "Body: $HTTP_BODY"
echo ""

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo "✅ Webhook test successful!"
else
  echo "❌ Webhook test failed"
  echo ""
  echo "Common issues:"
  echo "- 401: SHOPIFY_WEBHOOK_SECRET doesn't match"
  echo "- 400: Invalid payload or missing headers"
  echo "- 500: Server error (check Vercel logs)"
fi
