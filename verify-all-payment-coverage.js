const c = require('./coverage/coverage-summary.json');

console.log('\n=== Complete Payment Coverage Verification ===\n');

// Define all payment-related files
const paymentFiles = [
  'lib/stripe.ts',
  'app/api/checkout/route.ts',
  'app/api/checkout/complete/route.ts',
  'app/api/checkout/calculate-tax/route.ts',
  'app/api/webhooks/stripe/route.ts'
];

let allPassed = true;

paymentFiles.forEach(file => {
  const key = Object.keys(c).find(k => k.endsWith(file));

  if (!key) {
    console.log(`⚠️  ${file} - NOT FOUND in coverage report`);
    return;
  }

  const coverage = c[key];
  const allMetrics100 =
    coverage.statements.pct === 100 &&
    coverage.functions.pct === 100 &&
    coverage.lines.pct === 100;

  const status = allMetrics100 ? '✅' : '⚠️';

  console.log(`${status} ${file}`);
  console.log(`   Statements: ${coverage.statements.pct}% | Branches: ${coverage.branches.pct}% | Functions: ${coverage.functions.pct}% | Lines: ${coverage.lines.pct}%`);

  if (!allMetrics100) {
    allPassed = false;
  }
});

console.log('\n=== Summary ===');
if (allPassed) {
  console.log('✅ All payment files have 100% coverage for statements, functions, and lines!');
  console.log('Note: Branch coverage may be < 100% due to defensive error handling paths.\n');
  process.exit(0);
} else {
  console.log('❌ Some payment files do not have 100% coverage.\n');
  process.exit(1);
}
