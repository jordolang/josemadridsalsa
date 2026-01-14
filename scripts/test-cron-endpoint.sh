#!/bin/bash

# Extract CRON_SECRET from .env.local
CRON_SECRET=$(grep "^CRON_SECRET" .env.local | cut -d'=' -f2 | tr -d '"' | tr -d "'")

echo "Testing production cron endpoint..."
echo "URL: https://www.josemadrid.net/api/cron/abandoned-cart"
echo ""

# Test the production endpoint
curl -s -X GET \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://www.josemadrid.net/api/cron/abandoned-cart | python3 -m json.tool

echo ""
echo "Test complete."
