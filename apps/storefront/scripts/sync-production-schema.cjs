#!/usr/bin/env node

/**
 * Production Schema Sync Script
 *
 * This script syncs the Prisma schema to the production database.
 *
 * Usage:
 *   node scripts/sync-production-schema.cjs              # incremental push (may fail with FK/index conflicts)
 *   node scripts/sync-production-schema.cjs --force-reset # drops & recreates public schema first (clean slate)
 *
 * Prerequisites:
 *   - .env.vercel.production file must exist (run: vercel env pull .env.vercel.production --environment=production)
 *
 * What it does:
 *   - Reads DATABASE_URL (or POSTGRES_URL) from .env.vercel.production
 *   - Optionally drops and recreates the public schema to clear orphaned data / stale indexes
 *   - Runs `prisma db push` to sync schema without creating migrations
 *   - Creates or updates all tables to match prisma/schema.prisma
 *
 * Note: This uses POSTGRES_URL instead of DATABASE_URL because DATABASE_URL
 *       uses the Prisma Accelerate protocol which isn't compatible with db push.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const forceReset = process.argv.includes('--force-reset');

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
  log('\n🔄 Production Schema Sync Script\n', 'bright');

  // Check if .env.vercel.production exists
  const envPath = path.join(__dirname, '..', '.env.vercel.production');
  if (!fs.existsSync(envPath)) {
    log('❌ Error: .env.vercel.production file not found', 'red');
    log('\nRun this command first:', 'yellow');
    log('  vercel env pull .env.vercel.production --environment=production --yes\n', 'blue');
    process.exit(1);
  }

// Read production database URL
  const envContent = fs.readFileSync(envPath, 'utf8');

  // Prefer standard DATABASE_URL (Neon, most providers),
  // but fall back to legacy POSTGRES_URL if present.
  const dbUrlMatch =
    envContent.match(/DATABASE_URL=(.*)/) || envContent.match(/POSTGRES_URL=(.*)/);
  
  if (!dbUrlMatch) {
    log('❌ Error: DATABASE_URL or POSTGRES_URL not found in .env.vercel.production', 'red');
    log('   Make sure your Vercel project has a PostgreSQL/Neon database connected', 'yellow');
    process.exit(1);
  }
  
  let dbUrl = dbUrlMatch[1].trim().replace(/^["']|["']$/g, '');
  
  // Verify it's a valid postgres:// URL
  if (!dbUrl.startsWith('postgres://') && !dbUrl.startsWith('postgresql://')) {
    log('❌ Error: Invalid POSTGRES_URL format', 'red');
    log(`   Expected: postgres://... or postgresql://...`, 'yellow');
    log(`   Got: ${dbUrl.substring(0, 20)}...`, 'yellow');
    process.exit(1);
  }
  
  log('📋 Environment Configuration:', 'blue');
  log(`   Database Protocol: ${dbUrl.split(':')[0]}://...`);
  log('');

  // Set environment variable
  process.env.DATABASE_URL = dbUrl;

  // Confirm with user
  log('⚠️  This will sync your schema to production database', 'yellow');
  if (forceReset) {
    log('   🔴 --force-reset: ALL TABLES AND DATA WILL BE DROPPED', 'red');
  }
  log('   - New tables will be created', 'yellow');
  log('   - Existing tables may be altered', 'yellow');
  log('   - Data may be lost if schema changes are incompatible', 'yellow');
  log('\n   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n', 'yellow');

  // Wait 5 seconds
  execSync('sleep 5', { stdio: 'inherit' });

  const execEnv = { ...process.env, DATABASE_URL: dbUrl };
  const execOpts = { encoding: 'utf8', stdio: 'inherit', env: execEnv, cwd: path.join(__dirname, '..') };

  // ── Force-reset: drop and recreate the public schema ──────────────
  if (forceReset) {
    log('🗑️  Dropping and recreating public schema...\n', 'yellow');
    try {
      execSync(
        `psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO PUBLIC;"`,
        execOpts
      );
      log('✅ Public schema recreated\n', 'green');
    } catch (err) {
      // psql not installed – fall back to prisma db execute
      log('⚠️  psql not available, falling back to prisma db execute...\n', 'yellow');
      try {
        // Write a temp SQL file for prisma db execute
        const tmpSql = path.join(__dirname, '..', '.tmp-reset.sql');
        fs.writeFileSync(tmpSql, 'DROP SCHEMA public CASCADE;\nCREATE SCHEMA public;\nGRANT ALL ON SCHEMA public TO PUBLIC;\n');
        execSync(`npx prisma db execute --file ${tmpSql} --schema prisma/schema.prisma`, execOpts);
        fs.unlinkSync(tmpSql);
        log('✅ Public schema recreated via prisma db execute\n', 'green');
      } catch (innerErr) {
        log('\n❌ Failed to reset schema', 'red');
        log(innerErr.message, 'red');
        process.exit(1);
      }
    }
  }

  // ── Push schema ───────────────────────────────────────────────────
  try {
    log('🔄 Syncing schema to production database...\n', 'green');

    execSync('npx prisma db push --skip-generate --accept-data-loss', execOpts);

    log('\n✅ Schema successfully synced to production!', 'green');
    log('\n📊 Next Steps:', 'blue');
    if (forceReset) {
      log('   ⚠️  Database was reset — you MUST re-seed:', 'yellow');
      log('      npm run db:seed\n', 'blue');
    }
    log('   1. If this is a fresh database, seed it with data:');
    log('      node scripts/seed-production.cjs\n', 'blue');
    log('   2. Verify your application is working:');
    log('      https://www.josemadrid.net\n', 'blue');

  } catch (error) {
    log('\n❌ Error syncing schema', 'red');
    log(error.message, 'red');
    if (!forceReset) {
      log('\n💡 Tip: If this is a FK constraint or duplicate index error, try:', 'yellow');
      log('      npm run db:production:sync -- --force-reset', 'blue');
      log('   This will drop all tables and push a clean schema.\n', 'yellow');
    }
    process.exit(1);
  }
}

main();
