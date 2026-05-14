# Recommendations Optimization - Manual Verification Guide

## Overview
This document provides instructions for manually testing the optimized `getFrequentlyBoughtTogether` function with various product IDs to ensure the optimization works correctly.

## Test Script
A comprehensive test script has been created: `test-recommendations.mjs`

### Running the Test Script
```bash
# Option 1: Run the standalone test script
node test-recommendations.mjs

# Option 2: Test via the API endpoint (requires dev server running)
npm run dev
# Then in another terminal:
curl http://localhost:3000/api/products/{productId}/recommendations?type=frequently-bought
```

## Test Cases

The test script automatically identifies and tests the following product types:

### 1. Popular Products (Products with Many Orders)
- **Purpose**: Verify that products with extensive order history generate relevant recommendations
- **Expected**: Should return 1-4 co-purchased products with scores in descending order
- **Verification**:
  - Recommendations make logical sense (products commonly bought together)
  - Scores are normalized to [0, 1] range
  - Scores are in descending order
  - All products are in stock (inventory > 0)

### 2. Products with No Orders
- **Purpose**: Test edge case handling when a product has never been ordered
- **Expected**: Returns empty array or gracefully handles the scenario
- **Verification**:
  - No errors or crashes
  - Returns empty array `[]`
  - Query completes quickly without hanging

### 3. Random Products
- **Purpose**: General functionality test with arbitrary products
- **Expected**: Returns relevant recommendations if order history exists
- **Verification**:
  - Function behaves consistently
  - Data integrity maintained
  - Performance is acceptable

## Data Quality Checks

For each test case with results, verify:

### Required Fields Present
All returned products must have:
- ✅ `id` (string)
- ✅ `name` (string)
- ✅ `slug` (string)
- ✅ `price` (number >= 0)
- ✅ `sku` (string)
- ✅ `inventory` (number > 0)
- ✅ `score` (number 0-1)
- ✅ `featuredImage` (string | null)
- ✅ `heatLevel` (string | null)

### Score Normalization
- ✅ All scores must be in range [0, 1]
- ✅ Scores must be in descending order (highest first)
- ✅ Score calculation: `co_occurrence_count / max_count`

### Data Integrity
- ✅ All products are in stock (inventory > 0)
- ✅ All products are active (isActive = true)
- ✅ No duplicate product IDs
- ✅ No null or undefined values in required fields
- ✅ Target product is excluded from results

## Performance Verification

With `NODE_ENV=development`, the function logs query timing:

```
[Recommendations] getFrequentlyBoughtTogether: Starting query for productId: abc-123
[Recommendations] getFrequentlyBoughtTogether: Query completed in 45ms (3 results)
```

### Expected Performance
- **Before Optimization**: 3 separate queries (3 network round-trips)
- **After Optimization**: 1 combined SQL query (1 network round-trip)
- **Expected Improvement**: 30-60% reduction in query time (varies by network latency)

## API Endpoint Testing

### Manual API Test Commands

```bash
# Test with different product IDs
curl http://localhost:3000/api/products/PRODUCT_ID_1/recommendations?type=frequently-bought | jq
curl http://localhost:3000/api/products/PRODUCT_ID_2/recommendations?type=frequently-bought | jq
curl http://localhost:3000/api/products/PRODUCT_ID_3/recommendations?type=frequently-bought | jq
curl http://localhost:3000/api/products/PRODUCT_ID_4/recommendations?type=frequently-bought | jq
curl http://localhost:3000/api/products/PRODUCT_ID_5/recommendations?type=frequently-bought | jq
```

### Expected Response Format

```json
{
  "success": true,
  "data": {
    "frequentlyBoughtTogether": [
      {
        "id": "product-id",
        "name": "Product Name",
        "slug": "product-slug",
        "price": 12.99,
        "featuredImage": "https://...",
        "heatLevel": "Medium",
        "sku": "SKU-123",
        "inventory": 50,
        "score": 0.857
      }
    ]
  }
}
```

## Test Execution Checklist

- [ ] Run `test-recommendations.mjs` or API tests with 3-5 different product IDs
- [ ] Verify at least one product with many orders
- [ ] Verify at least one product with few/no orders
- [ ] Check all data quality criteria pass
- [ ] Verify scores are normalized (0-1 range)
- [ ] Verify scores are in descending order
- [ ] Verify all products are in stock
- [ ] Verify no duplicate products
- [ ] Check console logs for query timing (development mode)
- [ ] Verify no errors or crashes

## Success Criteria

✅ **Subtask is complete when:**
1. Test script has been created (`test-recommendations.mjs`)
2. Manual testing with 3-5 product IDs shows:
   - Correct data structure returned
   - Scores properly normalized
   - Recommendations are relevant
   - All data quality checks pass
   - No errors or crashes
3. Performance logging confirms optimization (single query vs 3 queries)

## Notes

- The test script (`test-recommendations.mjs`) automatically finds appropriate test products
- It tests edge cases (popular products, no orders, random products)
- It validates all data quality requirements
- Development-mode logging is enabled to see query performance
- The optimization reduced database calls from 3 to 1 per recommendation request
