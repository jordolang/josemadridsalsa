#!/bin/bash

# Vercel Environment Variables Setup Script
# This script helps you set up required environment variables for Vercel production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${MAGENTA}${BOLD}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Vercel Environment Variables Setup                      ║"
echo "║  Jose Madrid Salsa - Production Database Fix             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${CYAN}${BOLD}Step 1: Login to Vercel${NC}"
echo -e "${BLUE}If you're not already logged in, please authenticate now.${NC}"
vercel login

echo ""
echo -e "${CYAN}${BOLD}Step 2: Link to your Vercel project${NC}"
vercel link

echo ""
echo -e "${CYAN}${BOLD}Step 3: Configure Environment Variables${NC}"
echo ""

# Function to set environment variable
set_env_var() {
    local var_name=$1
    local var_description=$2
    local var_example=$3
    local is_secret=$4

    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}Setting: ${var_name}${NC}"
    echo -e "${BLUE}${var_description}${NC}"
    echo -e "${CYAN}Example: ${var_example}${NC}"
    echo ""

    # Check if variable already exists
    existing_value=$(vercel env pull --yes .env.vercel.local 2>/dev/null && grep "^${var_name}=" .env.vercel.local | cut -d '=' -f2- || echo "")

    if [ -n "$existing_value" ]; then
        if [ "$is_secret" = "true" ]; then
            echo -e "${GREEN}✓ ${var_name} is already set (value hidden)${NC}"
        else
            echo -e "${GREEN}✓ ${var_name} is already set to: ${existing_value}${NC}"
        fi
        read -p "Do you want to update it? (y/N): " update_choice
        if [ "$update_choice" != "y" ] && [ "$update_choice" != "Y" ]; then
            echo -e "${BLUE}Skipping ${var_name}${NC}"
            echo ""
            return
        fi
    fi

    read -p "Enter value for ${var_name}: " var_value

    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}⚠️  Skipped (no value provided)${NC}"
        echo ""
        return
    fi

    # Set the environment variable for production
    echo "$var_value" | vercel env add "$var_name" production

    echo -e "${GREEN}✓ ${var_name} set successfully${NC}"
    echo ""
}

# DATABASE_URL
set_env_var \
    "DATABASE_URL" \
    "Primary database connection string (REQUIRED)" \
    "prisma://accelerate.prisma-data.net/?api_key=..." \
    "true"

# NEXTAUTH_URL
set_env_var \
    "NEXTAUTH_URL" \
    "Production domain URL (REQUIRED)" \
    "https://www.josemadrid.net" \
    "false"

# NEXTAUTH_SECRET
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Setting: NEXTAUTH_SECRET${NC}"
echo -e "${BLUE}JWT encryption secret (REQUIRED)${NC}"
echo -e "${CYAN}Generate with: openssl rand -hex 32${NC}"
echo ""

existing_secret=$(vercel env pull --yes .env.vercel.local 2>/dev/null && grep "^NEXTAUTH_SECRET=" .env.vercel.local | cut -d '=' -f2- || echo "")

if [ -n "$existing_secret" ]; then
    echo -e "${GREEN}✓ NEXTAUTH_SECRET is already set${NC}"
    read -p "Do you want to update it? (y/N): " update_choice
    if [ "$update_choice" != "y" ] && [ "$update_choice" != "Y" ]; then
        echo -e "${BLUE}Skipping NEXTAUTH_SECRET${NC}"
        echo ""
    else
        nextauth_secret=$(openssl rand -hex 32)
        echo "$nextauth_secret" | vercel env add "NEXTAUTH_SECRET" production
        echo -e "${GREEN}✓ NEXTAUTH_SECRET generated and set${NC}"
        echo ""
    fi
else
    read -p "Generate NEXTAUTH_SECRET automatically? (Y/n): " gen_choice
    if [ "$gen_choice" = "n" ] || [ "$gen_choice" = "N" ]; then
        read -p "Enter NEXTAUTH_SECRET value: " nextauth_secret
        echo "$nextauth_secret" | vercel env add "NEXTAUTH_SECRET" production
    else
        nextauth_secret=$(openssl rand -hex 32)
        echo "$nextauth_secret" | vercel env add "NEXTAUTH_SECRET" production
        echo -e "${GREEN}✓ NEXTAUTH_SECRET generated and set${NC}"
    fi
    echo ""
fi

# MASTER_KEY
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Setting: MASTER_KEY${NC}"
echo -e "${BLUE}Admin panel encryption key (REQUIRED)${NC}"
echo -e "${CYAN}Generate with: openssl rand -hex 32${NC}"
echo ""

existing_master=$(vercel env pull --yes .env.vercel.local 2>/dev/null && grep "^MASTER_KEY=" .env.vercel.local | cut -d '=' -f2- || echo "")

if [ -n "$existing_master" ]; then
    echo -e "${GREEN}✓ MASTER_KEY is already set${NC}"
    read -p "Do you want to update it? (y/N): " update_choice
    if [ "$update_choice" != "y" ] && [ "$update_choice" != "Y" ]; then
        echo -e "${BLUE}Skipping MASTER_KEY${NC}"
        echo ""
    else
        master_key=$(openssl rand -hex 32)
        echo "$master_key" | vercel env add "MASTER_KEY" production
        echo -e "${GREEN}✓ MASTER_KEY generated and set${NC}"
        echo ""
    fi
else
    read -p "Generate MASTER_KEY automatically? (Y/n): " gen_choice
    if [ "$gen_choice" = "n" ] || [ "$gen_choice" = "N" ]; then
        read -p "Enter MASTER_KEY value: " master_key
        echo "$master_key" | vercel env add "MASTER_KEY" production
    else
        master_key=$(openssl rand -hex 32)
        echo "$master_key" | vercel env add "MASTER_KEY" production
        echo -e "${GREEN}✓ MASTER_KEY generated and set${NC}"
    fi
    echo ""
fi

# Optional: Other environment variables
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Optional Environment Variables${NC}"
echo -e "${BLUE}Do you want to set up additional environment variables?${NC}"
echo -e "${CYAN}(Stripe, Google Maps, Email, etc.)${NC}"
read -p "Configure optional variables? (y/N): " optional_choice
echo ""

if [ "$optional_choice" = "y" ] || [ "$optional_choice" = "Y" ]; then
    # Stripe
    set_env_var \
        "STRIPE_SECRET_KEY" \
        "Stripe secret key for payments" \
        "sk_live_..." \
        "true"

    # Google Maps
    set_env_var \
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" \
        "Google Maps API key (public)" \
        "AIza..." \
        "true"

    # Email
    set_env_var \
        "RESEND_API_KEY" \
        "Resend API key for transactional emails" \
        "re_..." \
        "true"

    set_env_var \
        "FROM_EMAIL" \
        "From email address" \
        "orders@josemadridsalsa.com" \
        "false"
fi

# Clean up temporary file
rm -f .env.vercel.local

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}✓ Environment variables setup complete!${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${CYAN}${BOLD}Step 4: Redeploy your application${NC}"
echo ""
echo -e "${BLUE}Option A: Redeploy via Vercel Dashboard${NC}"
echo "  1. Go to https://vercel.com/dashboard"
echo "  2. Select your project"
echo "  3. Go to Deployments tab"
echo "  4. Click ⋯ on latest deployment → Redeploy"
echo ""
echo -e "${BLUE}Option B: Push to trigger automatic deployment${NC}"
echo "  git commit --allow-empty -m \"fix: trigger redeploy with updated env vars\""
echo "  git push origin main"
echo ""

read -p "Do you want to trigger a redeployment now? (y/N): " redeploy_choice

if [ "$redeploy_choice" = "y" ] || [ "$redeploy_choice" = "Y" ]; then
    echo ""
    echo -e "${BLUE}Triggering redeployment...${NC}"
    vercel --prod
    echo ""
    echo -e "${GREEN}✓ Deployment triggered!${NC}"
    echo -e "${CYAN}Monitor deployment: https://vercel.com/dashboard${NC}"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Next Steps:${NC}"
echo -e "${BLUE}1. Wait for deployment to complete (2-3 minutes)${NC}"
echo -e "${BLUE}2. Test your website: https://www.josemadrid.net${NC}"
echo -e "${BLUE}3. Verify login works${NC}"
echo -e "${BLUE}4. Check find-us page loads locations${NC}"
echo -e "${BLUE}5. Run diagnostic: node scripts/diagnose-db-connection.cjs${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo -e "${MAGENTA}${BOLD}For detailed troubleshooting, see: docs/PRODUCTION_DATABASE_FIX.md${NC}"
