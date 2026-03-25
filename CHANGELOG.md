# Changelog

All notable changes to the Jose Madrid Salsa e-commerce platform are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [Unreleased]

### Added
- `CONTRIBUTING.md` — contributor guidelines and development workflow
- Comprehensive `AGENTS.md` — mandatory AI agent operating standards
- Restructured `docs/` directory with consistent `UPPER_SNAKE_CASE.md` naming
- Consolidated `docs/DATABASE.md` from multiple redundant database fix documents
- Updated `docs/index.md` as a complete documentation hub with navigation tables

### Changed
- Cleaned root directory: removed logs, temp scripts, one-off verification reports, and non-project files
- Removed 50+ redundant, outdated, or duplicate documentation files from `docs/`
- Renamed lowercase doc files to follow `UPPER_SNAKE_CASE.md` convention
- Overhauled `README.md` with professional branding, feature overview, and setup guide

---

## [1.0.0] — 2026-03-16

### Added
- Online fundraising campaign management with participant tracking and real-time sales dashboards
- Admin dashboard for content and order management
- Real-time inventory tracking with automatic low-stock notifications
- Secure credential management in admin panel with password protection
- Complete shopping cart and checkout experience
- Payment processing via Stripe (cards, Apple Pay, Google Pay)
- Detailed product pages with images, variants, and nutritional information
- Side-by-side product comparison tool
- Automated order confirmation and shipping notification emails
- Mobile-responsive design across the entire platform
- Professional UI component library (Shadcn UI) for consistent design
- Role-based access control (RBAC) with 5 user roles and 28 granular permissions
- AES-256-GCM encryption for sensitive admin credentials
- Comprehensive audit logging system
- Google Places / Maps integration for retail location finder
- Password reset flow with email verification
- AI-powered customer support chatbot
- Multi-language support (English / Spanish) via next-intl
- Amplitude analytics integration for user behavior tracking
- Sentry error monitoring for production

### Changed
- Sign-in form provides real-time validation feedback as you type
- Enhanced product catalog with improved filtering and organization
- Production-ready infrastructure and deployment configuration

### Fixed
- Data import system for products, orders, and gift certificates
- Performance optimizations across checkout and product listing pages
