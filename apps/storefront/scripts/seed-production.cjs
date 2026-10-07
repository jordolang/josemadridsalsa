#!/usr/bin/env node

/**
 * Production Database Seeding Script
 * 
 * This script seeds the production database with initial data.
 * 
 * Usage:
 *   node scripts/seed-production.cjs
 * 
 * Prerequisites:
 *   - .env.vercel.production file must exist (run: vercel env pull .env.vercel.production --environment=production)
 *   - Prisma schema must be synced (tables must exist)
 * 
 * What it does:
 *   - Reads DATABASE_URL from .env.vercel.production
 *   - Runs the seed script (prisma/seed.ts) against production
 *   - Seeds products, categories, users, recipes, and sample data
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('\n🚀 Production Database Seeding Script\n', 'bright');

  // Check if .env.vercel.production exists
  const envPath = path.join(__dirname, '..', '.env.vercel.production');
  if (!fs.existsSync(envPath)) {
    log('❌ Error: .env.vercel.production file not found', 'red');
    log('\nRun this command first:', 'yellow');
    log('  vercel env pull .env.vercel.production --environment=production --yes\n', 'blue');
    process.exit(1);
  }

  // Read production DATABASE_URL
  const envContent = fs.readFileSync(envPath, 'utf8');
  const dbUrlMatch = envContent.match(/DATABASE_URL=(.*)/);
  
  if (!dbUrlMatch) {
    log('❌ Error: DATABASE_URL not found in .env.vercel.production', 'red');
    process.exit(1);
  }

  let dbUrl = dbUrlMatch[1].trim().replace(/^["']|["']$/g, '');
  
  log('📋 Environment Configuration:', 'blue');
  log(`   Database Protocol: ${dbUrl.split(':')[0]}://...`);
  log(`   Seed Admin Email: ${process.env.SEED_ADMIN_EMAIL || 'mike@josemadridsalsa.com'}`);
  log('');

  // Set environment variables
  process.env.DATABASE_URL = dbUrl;
  process.env.SEED_ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'mike@josemadridsalsa.com';
  process.env.SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123456';

  // Confirm with user
  log('⚠️  WARNING: This will clear and reseed the production database!', 'yellow');
  log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n', 'yellow');

  // Wait 5 seconds
  execSync('sleep 5', { stdio: 'inherit' });

  try {
    log('🌱 Seeding production database...\n', 'green');
    
    execSync('npx tsx prisma/seed.ts', {
      encoding: 'utf8',
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: dbUrl },
      cwd: path.join(__dirname, '..')
    });
    
    log('\n✅ Production database seeded successfully!', 'green');
    log('\n📊 Next Steps:', 'blue');
    log('   1. Verify data at: https://www.josemadridsalsa.com');
    log('   2. Test login with admin credentials');
    log('   3. Check API endpoints:\n');
    log('      curl https://www.josemadridsalsa.com/api/products/featured', 'blue');
    log('      curl https://www.josemadridsalsa.com/api/products\n', 'blue');
    
  } catch (error) {
    log('\n❌ Error seeding database', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

main();
