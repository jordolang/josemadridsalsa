# Jose Madrid Salsa E-Commerce Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748.svg)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Overview

**Jose Madrid Salsa** is a modern, full-featured e-commerce platform built for selling artisan hot sauces and food products. The platform provides a complete solution for product management, order processing, customer engagement, and retail location tracking.

### About the Platform

This e-commerce system is designed to handle the complete lifecycle of an online food business, from product catalog management to order fulfillment and customer support. Built with enterprise-grade security and scalability in mind, it supports both direct-to-consumer sales and wholesale distribution through retail partner networks.

**Key Capabilities:**
- 🛒 **Product Catalog** - Comprehensive product management with SKU tracking, inventory control, and heat level categorization for hot sauces
- 📦 **Order Management** - Complete order processing with shipping integration, payment handling via Stripe, and automated fulfillment workflows
- 🎁 **Gift Certificates** - Digital gift certificate system with custom themes, scheduling, and automated delivery
- 📍 **Retail Locations** - Interactive store locator with Google Places integration for finding retail partners
- 📊 **Data Import/Export** - Bulk import capabilities for products, orders, gift certificates, and locations (CSV, Excel, JSON)
- 🔐 **Authentication & Authorization** - Secure user authentication with NextAuth.js, role-based access control, and admin dashboard
- 🌍 **Internationalization** - Multi-language support with next-intl for global markets
- 📧 **Email Marketing** - Transactional emails and marketing campaigns with Nodemailer and Resend integration
- 📈 **Analytics** - Amplitude integration for user behavior tracking and session replay
- 🔒 **Security** - CodeQL scanning, secret detection, pre-commit hooks, and comprehensive security monitoring

### Tech Stack

**Frontend:**
- Next.js 15 with App Router and React Server Components
- TypeScript for type safety
- Tailwind CSS + Radix UI for responsive design
- Framer Motion for animations
- React Hook Form + Zod for form validation

**Backend:**
- Next.js API Routes with serverless functions
- Prisma ORM with PostgreSQL database
- NextAuth.js for authentication
- Stripe for payment processing
- Google APIs for location services

**Infrastructure:**
- Vercel deployment and hosting
- Prisma Accelerate for database connection pooling
- Vercel Analytics for performance monitoring
- Resend for transactional emails

**Developer Tools:**
- Husky for git hooks
- ESLint + Prettier for code quality
- Vitest for testing
- Gitleaks for secret scanning
- TypeScript for compile-time safety

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or later ([Download](https://nodejs.org/))
- **npm** 9.x or later (comes with Node.js)
- **PostgreSQL** 14.x or later ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))

### Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/josemadridsalsa.git
cd josemadridsalsa
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages and automatically run `prisma generate` via the postinstall script.

### Step 3: Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

**Required Environment Variables (Minimum Setup):**

```bash
# Database - Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/josemadridsalsa"

# NextAuth.js - Required
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# Encryption - Required
MASTER_KEY="your-master-key-here"  # Generate with: openssl rand -base64 32
ENCRYPTION_KEY="your-encryption-key-here"  # Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Stripe (Test Mode) - Required for checkout
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Email - Required for order confirmations
RESEND_API_KEY="re_..."
FROM_EMAIL="orders@yourdomain.com"
```

**Optional Environment Variables (Enhanced Features):**

```bash
# Google Maps & Places - For location features
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-maps-api-key"
GOOGLE_PLACES_API_KEY="your-places-api-key"

# Google Calendar - For "Where is Jose" schedule
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID="your-calendar-id@group.calendar.google.com"

# Analytics - For user behavior tracking
GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"
NEXT_PUBLIC_AMPLITUDE_API_KEY="your-amplitude-api-key"

# OAuth - For social login
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"

# File Upload - For product images and documents
UPLOADTHING_SECRET="your-uploadthing-secret"
UPLOADTHING_APP_ID="your-uploadthing-app-id"
```

> **Note:** See `.env.example` for complete list of all available environment variables.

### Step 4: Setup Database

**Create the database:**

```bash
# Using PostgreSQL command line
createdb josemadridsalsa

# Or connect to PostgreSQL and run:
# CREATE DATABASE josemadridsalsa;
```

**Run database migrations:**

```bash
npm run db:push
```

This creates all required tables and schema in your database.

**Seed initial data (optional but recommended):**

```bash
# Seed products, categories, and sample data
npm run db:seed

# Seed recipe data
npm run db:seed:recipes

# Seed email templates
npm run db:seed:email-templates
```

### Step 5: Create an Admin Account

```bash
npm run create-admin
```

Follow the prompts to create your first admin user. You'll need:
- Email address
- Password
- Name

This account will have full admin access to the platform.

### Step 6: Start Development Server

```bash
npm run dev
```

The application will start at **http://localhost:3000**

**Alternative development commands:**

```bash
npm run dev:fast     # Fast refresh with Turbopack on port 3000
npm run dev:debug    # Start with Node.js debugger enabled
```

### Step 7: Access the Application

Once the server is running, you can access:

- **🏠 Homepage:** http://localhost:3000
- **🛒 Shop:** http://localhost:3000/shop
- **🔐 Admin Dashboard:** http://localhost:3000/admin
- **📊 Data Import:** http://localhost:3000/admin/import
- **📍 Locations:** http://localhost:3000/locations
- **📝 Admin Login:** http://localhost:3000/auth/signin

**First-Time Admin Tasks:**

1. **Login to Admin Dashboard** - Use the credentials you created in Step 5
2. **Configure Site Settings** - Navigate to Admin > Settings
3. **Add Products** - Go to Admin > Products or use Data Import
4. **Setup Stripe Webhooks** - Configure in Stripe Dashboard (see [Stripe Setup Guide](./docs/STRIPE_SETUP.md))
5. **Test Checkout Flow** - Use Stripe test cards to verify payment processing

### Step 8: Setup Security (Recommended)

**Install Gitleaks for secret scanning:**

```bash
# macOS
brew install gitleaks

# Linux
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/

# Windows (using Chocolatey)
choco install gitleaks
```

**Setup pre-commit hooks:**

```bash
npm run prepare
```

This enables automatic secret scanning before each commit.

### Common Development Commands

```bash
# Database
npm run db:studio          # Open Prisma Studio (database GUI)
npm run db:migrate         # Create and run new migration
npm run db:push            # Push schema changes to database
npm run db:reset           # Reset database (destructive!)
npm run db:seed            # Seed database with sample data

# Development
npm run dev                # Start development server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run ESLint
npm run type-check         # Run TypeScript compiler

# Data Import
npm run locations:import   # Import locations from markdown
npm run products:import    # Import products from CSV

# Testing
npm run test               # Run test suite

# Security
npm run security:scan      # Scan for secrets in codebase
npm run security:protect   # Check staged files before commit
```

### Troubleshooting

**Port already in use:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9
```

**Database connection issues:**
```bash
# Test database connection
npm run db:diagnose

# Verify PostgreSQL is running
pg_isready
```

**Prisma Client errors:**
```bash
# Regenerate Prisma Client
npm run db:generate
```

**Module not found errors:**
```bash
# Clean install
npm run clean
npm install
```

**Build errors:**
```bash
# Clear Next.js cache and rebuild
npm run clean
npm run build
```

### Next Steps

- 📖 **Read the Documentation** - Check out [docs/](./docs/) for detailed guides
- 🎨 **Customize Branding** - Update colors, logos, and content
- 📦 **Import Data** - See [Data Import Guide](./docs/IMPORT_GUIDE.md)
- 🚀 **Deploy to Production** - See [Deployment Guide](./docs/DEPLOYMENT.md)
- 🤖 **Setup AI Chatbot** - See [AI Chatbot Quick Start](./docs/AI_CHATBOT_QUICK_START.md)

## Features

### E-Commerce Core

- **🛒 Product Catalog Management**
  - Multi-variant products with SKU tracking and barcode support
  - Heat level categorization system for hot sauces (Mild, Medium, Hot, Extra Hot, Fruit)
  - Rich product descriptions with Markdown support
  - Nutritional information and ingredient tracking
  - Product tags and search keywords for discoverability
  - Featured products and customizable sort ordering
  - Product images with featured image selection

- **📦 Order Processing & Fulfillment**
  - Complete order lifecycle management with status tracking
  - Multi-item orders with line item details
  - Shipping address validation and storage
  - Billing address management (separate from shipping)
  - Order notes and customer communication
  - Tax calculation integration with Stripe Tax
  - Order history and tracking for customers

- **💳 Payment Processing**
  - Stripe payment integration for secure transactions
  - Support for credit cards, debit cards, and digital wallets
  - Test and live mode support
  - Automatic tax calculation by location
  - Refund and partial refund capabilities
  - Payment failure handling and retry logic

- **📊 Inventory Management**
  - Real-time inventory tracking with SKU-level accuracy
  - Low stock threshold alerts and notifications
  - Inventory transaction history and audit trail
  - Multi-location inventory support
  - Automated inventory adjustments on orders
  - Cost price tracking for margin analysis

### Customer Experience

- **🛍️ Shopping Cart & Wishlist**
  - Persistent shopping cart across sessions
  - Guest and authenticated user carts
  - Wishlist functionality for saved products
  - Abandoned cart tracking and recovery
  - Cart item quantity management
  - Real-time price and availability updates

- **🎁 Gift Certificate System**
  - Digital gift certificates with custom amounts
  - Customizable themes and personalized messages
  - Scheduled delivery for future dates
  - Recipient email delivery with professional templates
  - Gift certificate balance tracking
  - Redemption code generation and validation

- **⭐ Product Reviews & Ratings**
  - Customer product reviews with star ratings
  - Verified purchase badges
  - Review moderation and approval workflow
  - Helpful vote system for reviews
  - Image uploads in reviews
  - Review filtering and sorting

- **🔐 User Authentication & Profiles**
  - Secure user registration and login with NextAuth.js
  - Role-based access control (Customer, Admin, Wholesale Partner)
  - Email verification system
  - Password reset functionality with secure tokens
  - Customer profile management
  - Address book with multiple saved addresses
  - Order history and tracking

### Business Features

- **🏪 Wholesale & Partner Management**
  - Wholesale account system with volume pricing
  - Partner-specific pricing tiers
  - Wholesale order minimum requirements
  - Partner API keys for integrations
  - Retail partner dashboard
  - Wholesale catalog management

- **📍 Retail Location Directory**
  - Interactive store locator with Google Maps integration
  - Google Places API integration for location data
  - Store hours and contact information
  - Product availability by location
  - Distance-based search and filtering
  - Location verification and management

- **🎯 Fundraising Platform**
  - Customizable fundraising campaigns
  - Fundraiser-specific product selection
  - Revenue sharing and tracking
  - Campaign goals and progress tracking
  - Fundraiser dashboard for organizers
  - Participant management

- **💰 Loyalty & Rewards Program**
  - Points-based loyalty system
  - Earn points on purchases
  - Redeem points for discounts
  - Loyalty tier management
  - Transaction history and balance tracking
  - Automated point accrual on orders

### Marketing & Promotions

- **🎫 Discount & Coupon System**
  - Percentage and fixed-amount discounts
  - Single-use and multi-use coupon codes
  - Minimum purchase requirements
  - Expiration date management
  - Usage tracking and analytics
  - Customer-specific discount codes

- **📧 Email Marketing & Campaigns**
  - Newsletter subscription management
  - Transactional email system (order confirmations, shipping notifications)
  - Marketing campaign builder
  - Email template customization
  - Subscriber segmentation
  - Integration with Resend and Nodemailer

- **📱 Subscription Management**
  - Recurring product subscriptions
  - Flexible delivery schedules (weekly, monthly, quarterly)
  - Subscription pause and resume
  - Automatic billing and order creation
  - Subscription modification and cancellation
  - Subscriber dashboard

### Analytics & Insights

- **📈 Business Analytics**
  - Amplitude integration for event tracking
  - User behavior analysis and session replay
  - Conversion funnel tracking
  - Product performance metrics
  - Sales reporting and trends
  - Customer lifetime value analysis

- **🔍 Search & Discovery**
  - Product search with keyword matching
  - Category-based navigation
  - Heat level filtering for hot sauces
  - Price range filtering
  - Sort by price, popularity, newest
  - Search keyword optimization

### Administrative Tools

- **🛠️ Data Import & Export**
  - Bulk product import (CSV, Excel, JSON)
  - Order history import for migrations
  - Gift certificate batch creation
  - Retail location bulk upload
  - Comprehensive validation and error reporting
  - Template downloads for each import type
  - See [Data Import Guide](./docs/IMPORT_GUIDE.md) for details

- **👥 Customer Service**
  - Customer conversation tracking
  - Support ticket system
  - Order issue resolution
  - Customer communication history
  - Admin notes on customer accounts

- **🌍 Internationalization**
  - Multi-language support with next-intl
  - Localized content and translations
  - Currency formatting by locale
  - Date and time localization
  - RTL language support

- **🔒 Security & Compliance**
  - CodeQL security scanning for vulnerabilities
  - Secret detection and prevention
  - Pre-commit hooks for code quality
  - GDPR compliance features
  - Secure password hashing
  - API rate limiting and abuse prevention

## Security Features

✅ **CodeQL Security Scanning** - Automated code analysis for vulnerabilities
✅ **Secret Detection** - Multiple layers of API key and credential protection
✅ **Pre-commit Hooks** - Local prevention of secret commits
✅ **GitHub Actions Integration** - Automated CI/CD security checks
✅ **Dependency Monitoring** - Track vulnerable packages

## Data Import

The platform includes comprehensive data import capabilities for migrating existing data or bulk uploading new content. Import functionality supports:

- **Products** - Hot sauce catalog with SKUs, pricing, inventory, and metadata
- **Orders** - Historical orders with line items, shipping, and payment information
- **Gift Certificates** - Digital gift certificates with custom themes and messages
- **Retail Locations** - Physical store locations that carry Jose Madrid Salsa products

### Supported Formats
- CSV (.csv) - Universal support for all data types
- Excel (.xlsx, .xls) - Products, Orders
- JSON (.json) - Products with complex nested data

### Key Features
- ✨ **Validation** - Comprehensive data validation before import
- 📊 **Batch Processing** - Efficient handling of large datasets
- 🔄 **Flexible Options** - Auto-create missing relationships, skip duplicates
- 📝 **Error Reporting** - Detailed error messages with row and field identification
- 📥 **Template Downloads** - Pre-formatted templates for each import type

For detailed documentation, field specifications, and troubleshooting, see the **[Data Import Guide](./docs/IMPORT_GUIDE.md)**.

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Pre-commit Hooks

```bash
npm run prepare
```

### 3. Install Gitleaks (for local scanning)

**macOS:**
```bash
brew install gitleaks
```

**Linux:**
```bash
# Download latest release
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**Windows:**
```bash
# Using Chocolatey
choco install gitleaks

# Or download from GitHub releases
```

### 4. Copy Workflows to Your Repository

```bash
# Copy the .github folder to your repository root
cp -r .github /path/to/your/repository/

# Copy security configs
cp .gitleaks.toml /path/to/your/repository/
cp .pre-commit-config.yaml /path/to/your/repository/
cp SECURITY.md /path/to/your/repository/
cp .gitignore /path/to/your/repository/
```

### 5. Enable GitHub Security Features

1. Go to your repository **Settings**
2. Navigate to **Security & analysis**
3. Enable:
   - ✅ Dependency graph
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Secret scanning
   - ✅ Push protection

## Usage

### Local Secret Scanning

Before committing:
```bash
npm run security:scan
```

### Protect Staged Changes

Check staged files for secrets:
```bash
npm run security:protect
```

### Generate Security Baseline

Create a baseline report:
```bash
npm run security:baseline
```

## GitHub Actions Workflows

### CodeQL Analysis
- Runs on: Push, Pull Request, Weekly schedule
- Languages: JavaScript, TypeScript
- Queries: Security-extended and quality checks

### Secret Scanning
- Runs on: Every push and PR
- Tools: TruffleHog + Gitleaks
- Detects: API keys, tokens, credentials

## Detected Secret Types

- Vercel API tokens
- Google API keys (Maps, Places)
- Stripe keys (test & live)
- GitHub tokens (PAT, OAuth, App)
- NPM tokens
- Generic API keys
- Environment variable exposures

## Environment Variables Best Practices

### Local Development

Create a `.env.local` file (never commit):
```bash
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
VERCEL_TOKEN=your_token_here
```

### Vercel Deployment

Add environment variables in Vercel dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add variables for each environment

### Example `.env.example`

Create this file to document required variables:
```bash
# Google Places API
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=

# Vercel
VERCEL_TOKEN=

# Add other required variables
```

## Troubleshooting

### Pre-commit Hook Fails

If the hook prevents your commit:
1. Review the flagged files
2. Remove any secrets
3. Use environment variables instead
4. Try committing again

### False Positives

Edit `.gitleaks.toml` to add to allowlist:
```toml
[allowlist]
regexes = [
  '''YOUR_EXAMPLE_STRING'''
]
```

### Skip Hooks (Emergency Only)

```bash
git commit --no-verify -m "your message"
```

**⚠️ Use sparingly and scan manually afterward!**

## Additional Security

### Vercel-Specific

- Use environment variables for all secrets
- Enable "Deployment Protection" in Vercel
- Restrict API to specific domains
- Use different keys per environment

### GitHub-Specific

- Enable branch protection rules
- Require status checks to pass
- Require pull request reviews
- Enable "Require signed commits"

## Support

For security issues, see [SECURITY.md](./SECURITY.md)

---

**Built for Jlang.dev** | Protecting your code and credentials
