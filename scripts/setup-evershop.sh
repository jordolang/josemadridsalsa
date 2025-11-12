#!/bin/bash

# EverShop Setup Script
# This script helps configure EverShop for integration with Jose Madrid Salsa

set -e

echo "==================================="
echo "EverShop Integration Setup"
echo "==================================="
echo ""

# Ensure EverShop directory exists
if [ ! -d evershop ]; then
    echo "❌ Error: evershop directory not found"
    echo "Make sure the EverShop package is installed at ./evershop"
    exit 1
fi

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local not found"
    echo "Please create .env.local first with your DATABASE_URL"
    exit 1
fi

# Helper to read env var from .env.local
read_env_var() {
    local key="$1"
    # Use grep -m 1 to avoid matching commented lines later in file
    local value
    value=$(grep -m 1 "^$key=" .env.local | cut -d '=' -f2- | tr -d '"' | tr -d "'")
    echo "$value"
}

# Extract database credentials from .env.local
echo "📋 Reading database configuration from .env.local..."

POSSIBLE_VARS=("DATABASE_URL" "POSTGRES_URL" "DATABASE_DIRECT_URL" "DIRECT_DATABASE_URL" "SHADOW_DATABASE_URL" "PRISMA_DATABASE_URL")
DATABASE_URL=""
DATABASE_URL_SOURCE=""

for VAR_NAME in "${POSSIBLE_VARS[@]}"; do
    VALUE=$(read_env_var "$VAR_NAME")
    if [ -n "$VALUE" ]; then
        # Ignore Accelerate protocol URLs since they cannot be used directly
        if [[ "$VALUE" == prisma+postgres://* ]]; then
            continue
        fi
        DATABASE_URL="$VALUE"
        DATABASE_URL_SOURCE="$VAR_NAME"
        break
    fi
done

if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Could not find a usable PostgreSQL connection string."
    echo "Please add DATABASE_URL or POSTGRES_URL in standard postgres:// format to .env.local"
    exit 1
fi

# Parse PostgreSQL connection string (postgres:// or postgresql://)
if [[ $DATABASE_URL =~ ^postgres(ql)?://([^:]+):([^@]+)@([^:]+):([^/]+)/([^?]+) ]]; then
    DB_USER="${BASH_REMATCH[2]}"
    DB_PASSWORD="${BASH_REMATCH[3]}"
    DB_HOST="${BASH_REMATCH[4]}"
    DB_PORT="${BASH_REMATCH[5]}"
    DB_NAME="${BASH_REMATCH[6]}"
else
    echo "❌ Error: Could not parse connection string from $DATABASE_URL_SOURCE"
    echo "Expected format: postgresql://user:password@host:port/database"
    exit 1
fi

echo "✅ Database configuration parsed successfully (source: $DATABASE_URL_SOURCE)"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""

# Generate secure keys
echo "🔐 Generating secure API keys..."
EVERSHOP_API_KEY=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)

# Ensure directory exists
mkdir -p evershop

# Create EverShop .env file
echo "📝 Creating evershop/.env file..."
cat > evershop/.env << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_SCHEMA=evershop

# Server Configuration
PORT=3001
HOST=localhost

# Admin User (change password after first login)
ADMIN_EMAIL=admin@josemadridsalsa.com
ADMIN_PASSWORD=ChangeMe123!

# API Security
EVERSHOP_API_KEY=$EVERSHOP_API_KEY
SESSION_SECRET=$SESSION_SECRET

# Integration with Next.js
NEXTJS_API_URL=http://localhost:3000/api
NEXTJS_WEBHOOK_SECRET=$WEBHOOK_SECRET

# Shop Settings
SHOP_NAME=Jose Madrid Salsa
SHOP_CURRENCY=USD
SHOP_LANGUAGE=en
EOF

echo "✅ evershop/.env created"
echo ""

# Update Next.js .env.local with EverShop keys
echo "📝 Adding EverShop configuration to .env.local..."

# Check if EverShop config already exists
if grep -q "EVERSHOP_API_URL" .env.local; then
    echo "⚠️  EverShop configuration already exists in .env.local"
    echo "   Skipping update. Please update manually if needed."
else
    cat >> .env.local << EOF

# EverShop Integration
EVERSHOP_API_URL=http://localhost:3001/api
EVERSHOP_API_KEY=$EVERSHOP_API_KEY
EVERSHOP_WEBHOOK_SECRET=$WEBHOOK_SECRET
EOF
    echo "✅ .env.local updated"
fi

echo ""
echo "🎉 Configuration complete!"
echo ""
echo "Next steps:"
echo "1. Create the 'evershop' schema in PostgreSQL:"
echo "   psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c 'CREATE SCHEMA IF NOT EXISTS evershop;'"
echo ""
echo "2. Run EverShop setup (from the evershop directory):"
echo "   cd evershop && npm run setup"
echo ""
echo "3. Start EverShop:"
echo "   cd evershop && npm run dev"
echo ""
echo "4. Access EverShop admin at:"
echo "   http://localhost:3001/admin"
echo "   Email: admin@josemadridsalsa.com"
echo "   Password: ChangeMe123! (change this after first login)"
echo ""
echo "5. Test the integration:"
echo "   npm run dev (in main directory)"
echo "   Create a test order and check if it syncs to EverShop"
echo ""
echo "📚 Documentation: docs/evershop-integration.md"
echo "==================================="
