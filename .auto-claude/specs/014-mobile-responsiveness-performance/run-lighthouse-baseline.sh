#!/bin/bash

# Lighthouse Baseline Audit Script
# Run this script to capture baseline mobile performance metrics
# before mobile optimizations are deployed

set -e

echo "🚀 Starting Lighthouse Baseline Audit..."
echo "=========================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Error: Development server is not running on port 3000"
    echo "Please start the server with: npm run dev"
    exit 1
fi

echo "✅ Server is running on port 3000"
echo ""

# Create output directory
SPEC_DIR="./.auto-claude/specs/014-mobile-responsiveness-performance"
mkdir -p "$SPEC_DIR/lighthouse-reports"

# Timestamp for report files
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")

echo "📊 Running Lighthouse audits on key pages..."
echo ""

# Array of pages to audit
declare -a pages=(
    "http://localhost:3000/:homepage"
    "http://localhost:3000/products:products-listing"
    "http://localhost:3000/salsas:salsas-category"
)

# Run Lighthouse on each page
for page_info in "${pages[@]}"; do
    IFS=':' read -r url name <<< "$page_info"
    echo "🔍 Auditing: $name ($url)"

    # Run Lighthouse with mobile preset
    npx lighthouse "$url" \
        --only-categories=performance \
        --preset=perf \
        --form-factor=mobile \
        --screenEmulation.mobile=true \
        --screenEmulation.width=375 \
        --screenEmulation.height=667 \
        --screenEmulation.deviceScaleFactor=2 \
        --throttling.rttMs=150 \
        --throttling.throughputKbps=1638 \
        --throttling.requestLatencyMs=150 \
        --throttling.downloadThroughputKbps=1638 \
        --throttling.uploadThroughputKbps=675 \
        --output=json \
        --output=html \
        --output-path="$SPEC_DIR/lighthouse-reports/baseline-$name-$TIMESTAMP" \
        --quiet

    echo "✅ $name audit complete"
    echo ""
done

echo "=========================================="
echo "✅ Baseline audits complete!"
echo ""
echo "📁 Reports saved to: $SPEC_DIR/lighthouse-reports/"
echo ""
echo "📊 Summary:"
echo "To view HTML reports, open:"
for page_info in "${pages[@]}"; do
    IFS=':' read -r url name <<< "$page_info"
    echo "  - $SPEC_DIR/lighthouse-reports/baseline-$name-$TIMESTAMP.report.html"
done
echo ""
echo "To extract scores programmatically:"
echo "  jq '.categories.performance.score * 100' $SPEC_DIR/lighthouse-reports/baseline-*.report.json"
echo ""
echo "Next steps:"
echo "1. Review the baseline scores in the HTML reports"
echo "2. Record key metrics in build-progress.txt:"
echo "   - Performance Score"
echo "   - First Contentful Paint (FCP)"
echo "   - Time to Interactive (TTI)"
echo "   - Largest Contentful Paint (LCP)"
echo "3. Use these baselines to measure improvement after optimizations"
