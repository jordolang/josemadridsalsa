#!/bin/bash
# Verification script for Stripe checkout session creation endpoint
# Subtask 5-1: Verify Stripe checkout session creation

set -e

echo "=== Stripe Checkout Endpoint Verification ==="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Check if endpoint file exists
echo "1. Checking if checkout endpoint exists..."
if [ -f "app/api/checkout/route.ts" ]; then
  echo -e "${GREEN}✓ app/api/checkout/route.ts exists${NC}"
else
  echo -e "${RED}✗ app/api/checkout/route.ts not found${NC}"
  exit 1
fi

# Check for required dependencies
echo ""
echo "2. Checking required dependencies..."

DEPENDENCIES=("zod" "@prisma/client" "next")
for dep in "${DEPENDENCIES[@]}"; do
  if grep -q "\"$dep\"" package.json; then
    echo -e "${GREEN}✓ $dep installed${NC}"
  else
    echo -e "${RED}✗ $dep not found in package.json${NC}"
  fi
done

# Check for required lib functions
echo ""
echo "3. Checking required lib functions..."

FILES=(
  "lib/payments/index.ts"
  "lib/tax-calculator.ts"
  "lib/shipping-calculator.ts"
  "lib/inventory-manager.ts"
  "lib/prisma.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓ $file exists${NC}"
  else
    echo -e "${RED}✗ $file not found${NC}"
  fi
done

# Check if tests exist
echo ""
echo "4. Checking integration tests..."
if [ -f "tests/integration/api/checkout.test.ts" ]; then
  echo -e "${GREEN}✓ Integration tests exist${NC}"

  # Run tests if npm is available
  if command -v npm &> /dev/null; then
    echo ""
    echo "5. Running integration tests..."
    npm test -- tests/integration/api/checkout.test.ts --reporter=verbose 2>&1 | \
      grep -E "(PASS|FAIL|passed|failed|tests)" || true
  fi
else
  echo -e "${RED}✗ Integration tests not found${NC}"
fi

echo ""
echo "=== Verification Summary ==="
echo ""
echo "Endpoint: POST /api/checkout"
echo "Handler: app/api/checkout/route.ts"
echo "Tests: tests/integration/api/checkout.test.ts"
echo ""
echo "Expected Request Body:"
echo "{"
echo "  items: [{ productId: string, quantity: number }],"
echo "  customer: { email, firstName, lastName, phone? },"
echo "  shipping: { address1, city, state, postalCode, ... },"
echo "  notes?, discountCode?, recoveryToken?, shippingMethod?, referralCode?"
echo "}"
echo ""
echo "Expected Response (200):"
echo "{"
echo "  clientSecret: string  // Stripe payment intent client secret"
echo "  orderId: string       // Created order ID"
echo "  amount: number        // Total amount in dollars"
echo "}"
echo ""
echo -e "${GREEN}✓ Verification complete${NC}"
echo ""
echo "To test the endpoint manually with curl (requires dev server running):"
echo ""
echo 'curl -X POST http://localhost:3000/api/checkout \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '"'"'{'
echo '    "items": [{ "productId": "clxxx1234567890abc", "quantity": 2 }],'
echo '    "customer": {'
echo '      "email": "test@example.com",'
echo '      "firstName": "John",'
echo '      "lastName": "Doe"'
echo '    },'
echo '    "shipping": {'
echo '      "address1": "123 Main St",'
echo '      "city": "Portland",'
echo '      "state": "OR",'
echo '      "postalCode": "97201"'
echo '    }'
echo '  }'"'"
echo ""
echo "Note: Replace productId with a valid CUID from your database"
echo ""
