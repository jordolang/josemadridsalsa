const c = require('./coverage/coverage-summary.json');

// Find the stripe.ts file in the coverage report
const stripeKey = Object.keys(c).find(key => key.endsWith('lib/stripe.ts'));

if (!stripeKey) {
  console.error('❌ lib/stripe.ts not found in coverage report');
  console.log('Available files:', Object.keys(c).filter(k => k !== 'total'));
  process.exit(1);
}

const stripe = c[stripeKey];

console.log('\n=== Payment Coverage Verification ===');
console.log('File:', stripeKey);
console.log('Statements:', stripe.statements.pct + '%');
console.log('Branches:', stripe.branches.pct + '%');
console.log('Functions:', stripe.functions.pct + '%');
console.log('Lines:', stripe.lines.pct + '%');

// Check 100% requirement
if (stripe.statements.pct < 100) {
  console.error('\n❌ FAILED: Payment coverage below 100%');
  console.error('   Statements:', stripe.statements.pct + '%');
  process.exit(1);
}

if (stripe.branches.pct < 100) {
  console.error('\n❌ FAILED: Payment branch coverage below 100%');
  console.error('   Branches:', stripe.branches.pct + '%');
  process.exit(1);
}

if (stripe.functions.pct < 100) {
  console.error('\n❌ FAILED: Payment function coverage below 100%');
  console.error('   Functions:', stripe.functions.pct + '%');
  process.exit(1);
}

if (stripe.lines.pct < 100) {
  console.error('\n❌ FAILED: Payment line coverage below 100%');
  console.error('   Lines:', stripe.lines.pct + '%');
  process.exit(1);
}

console.log('\n✅ PASSED: Payment processing has 100% coverage!');
console.log('   All metrics (statements, branches, functions, lines) are at 100%\n');
process.exit(0);
