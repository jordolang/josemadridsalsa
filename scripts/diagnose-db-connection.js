#!/usr/bin/env node

/**
 * Database Connection Diagnostic Tool
 *
 * This script helps diagnose database connection issues in production and development.
 * It checks environment variables, tests the connection, and provides actionable feedback.
 */

const { PrismaClient } = require('@prisma/client')

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function section(title) {
  console.log('\n' + '='.repeat(60))
  log(title, colors.bright + colors.cyan)
  console.log('='.repeat(60))
}

async function checkEnvironmentVariables() {
  section('1. Environment Variables Check')

  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_URL: process.env.POSTGRES_URL,
    PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NODE_ENV: process.env.NODE_ENV,
  }

  let hasErrors = false

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) {
      log(`✗ ${key}: NOT SET`, colors.red)
      hasErrors = true
    } else {
      // Mask sensitive values
      const displayValue = ['DATABASE_URL', 'POSTGRES_URL', 'PRISMA_DATABASE_URL', 'NEXTAUTH_SECRET'].includes(key)
        ? value.substring(0, 20) + '...' + value.substring(value.length - 10)
        : value
      log(`✓ ${key}: ${displayValue}`, colors.green)
    }
  }

  // Check database URL format
  const dbUrl = envVars.DATABASE_URL || envVars.POSTGRES_URL || envVars.PRISMA_DATABASE_URL

  if (dbUrl) {
    console.log('\n' + 'Database URL Analysis:'.padEnd(20))

    if (dbUrl.startsWith('prisma://') || dbUrl.startsWith('prisma+postgres://')) {
      log('  Format: Prisma Accelerate', colors.blue)
      log('  ✓ This is the recommended format for production', colors.green)
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      log('  Format: Direct PostgreSQL connection', colors.blue)

      // Check if it's the problematic db.prisma.io URL
      if (dbUrl.includes('db.prisma.io')) {
        log('  ✗ ERROR: db.prisma.io is NOT publicly accessible!', colors.red)
        log('  ✗ This will cause all database queries to fail', colors.red)
        hasErrors = true
      } else if (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) {
        log('  ⚠ Warning: localhost connection (only works locally)', colors.yellow)
      } else {
        log('  ✓ External PostgreSQL connection', colors.green)
      }
    } else {
      log('  ✗ Unknown database URL format', colors.red)
      hasErrors = true
    }
  } else {
    log('\n✗ No database URL found!', colors.red)
    hasErrors = true
  }

  return !hasErrors
}

async function testDatabaseConnection() {
  section('2. Database Connection Test')

  try {
    const prisma = new PrismaClient({
      log: ['error', 'warn'],
    })

    log('Attempting to connect to database...', colors.blue)

    // Test connection with a simple query
    const startTime = Date.now()
    await prisma.$connect()
    const connectTime = Date.now() - startTime

    log(`✓ Successfully connected to database (${connectTime}ms)`, colors.green)

    // Test a simple query
    log('\nTesting database queries...', colors.blue)

    const queryStart = Date.now()
    const userCount = await prisma.user.count()
    const queryTime = Date.now() - queryStart

    log(`✓ User count query successful: ${userCount} users (${queryTime}ms)`, colors.green)

    // Test RetailLocation query (for find-us page)
    const locationStart = Date.now()
    const locationCount = await prisma.retailLocation.count()
    const locationTime = Date.now() - locationStart

    log(`✓ Location count query successful: ${locationCount} locations (${locationTime}ms)`, colors.green)

    await prisma.$disconnect()

    return true
  } catch (error) {
    log(`✗ Database connection failed!`, colors.red)
    console.error('\nError details:', error)

    if (error.message.includes('db.prisma.io')) {
      log('\n⚠ SOLUTION: The db.prisma.io host is not publicly accessible.', colors.yellow)
      log('   Use Prisma Accelerate URL instead:', colors.yellow)
      log('   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"', colors.cyan)
    } else if (error.message.includes('ECONNREFUSED')) {
      log('\n⚠ SOLUTION: Database server is not running or not accessible.', colors.yellow)
      log('   Check your DATABASE_URL and ensure the database is running.', colors.yellow)
    } else if (error.message.includes('authentication failed')) {
      log('\n⚠ SOLUTION: Invalid database credentials.', colors.yellow)
      log('   Check your username and password in DATABASE_URL.', colors.yellow)
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      log('\n⚠ SOLUTION: Database does not exist.', colors.yellow)
      log('   Run: npx prisma migrate deploy', colors.cyan)
    }

    return false
  }
}

async function checkVercelEnvironment() {
  section('3. Vercel Environment Check')

  if (process.env.VERCEL) {
    log('✓ Running on Vercel', colors.green)
    log(`  Environment: ${process.env.VERCEL_ENV || 'unknown'}`, colors.blue)
    log(`  Region: ${process.env.VERCEL_REGION || 'unknown'}`, colors.blue)
  } else {
    log('⚠ Not running on Vercel (local environment)', colors.yellow)
    log('  To check Vercel production environment:', colors.blue)
    log('  1. Go to https://vercel.com/dashboard', colors.cyan)
    log('  2. Select your project', colors.cyan)
    log('  3. Go to Settings > Environment Variables', colors.cyan)
    log('  4. Ensure DATABASE_URL is set for Production', colors.cyan)
  }
}

async function provideSolutions() {
  section('4. Solutions & Next Steps')

  log('\nFor Production (Vercel):', colors.bright)
  log('1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables', colors.cyan)
  log('2. Set DATABASE_URL for Production environment:', colors.cyan)
  log('   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"', colors.blue)
  log('3. Set NEXTAUTH_SECRET (generate with: openssl rand -hex 32):', colors.cyan)
  log('   NEXTAUTH_SECRET="your-32-character-secret"', colors.blue)
  log('4. Set NEXTAUTH_URL:', colors.cyan)
  log('   NEXTAUTH_URL="https://www.josemadrid.net"', colors.blue)
  log('5. Redeploy your application', colors.cyan)

  log('\nFor Local Development:', colors.bright)
  log('1. Create .env.local file:', colors.cyan)
  log('   cp .env.example .env.local', colors.blue)
  log('2. Update DATABASE_URL with your Neon or local PostgreSQL URL', colors.cyan)
  log('3. Run migrations:', colors.cyan)
  log('   npx prisma migrate dev', colors.blue)

  log('\nCommon Issues:', colors.bright)
  log('• db.prisma.io not accessible → Use Prisma Accelerate URL', colors.yellow)
  log('• Login not working → Check NEXTAUTH_SECRET is set', colors.yellow)
  log('• Locations not loading → Verify DATABASE_URL has read access', colors.yellow)
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════╗', colors.bright + colors.magenta)
  log('║  Database Connection Diagnostic Tool                     ║', colors.bright + colors.magenta)
  log('║  Jose Madrid Salsa - Production Database Fix             ║', colors.bright + colors.magenta)
  log('╚══════════════════════════════════════════════════════════╝', colors.bright + colors.magenta)

  const envOk = await checkEnvironmentVariables()
  const connectionOk = await testDatabaseConnection()
  await checkVercelEnvironment()
  await provideSolutions()

  section('5. Summary')

  if (envOk && connectionOk) {
    log('✓ All checks passed! Database is properly configured.', colors.green + colors.bright)
  } else {
    log('✗ Issues detected. Please follow the solutions above.', colors.red + colors.bright)
    process.exit(1)
  }
}

main().catch((error) => {
  log('\n✗ Diagnostic script failed:', colors.red)
  console.error(error)
  process.exit(1)
})
