# EverShop Order Management System

This directory contains the EverShop installation integrated with the Jose Madrid Salsa e-commerce platform.

## What is EverShop?

EverShop is a Node.js-based e-commerce platform that provides robust order management, fulfillment, and shipping capabilities. In this integration, EverShop serves as the **backend order management system** while the Next.js app handles the **customer-facing storefront**.

## Quick Start

See the main project's quick start guide: `../docs/evershop-quickstart.md`

## Directory Structure

```
evershop/
├── config/              # EverShop configuration
│   └── default.json     # Default settings
├── extensions/          # Custom EverShop extensions
│   └── sample/         # Sample extension
├── themes/             # Custom themes (if needed)
│   └── sample/         # Sample theme
├── node_modules/       # EverShop dependencies
├── package.json        # EverShop package configuration
└── .env               # Environment variables (not in git)
```

## Configuration

Configuration is managed through:
1. **Environment Variables** (`.env` file) - Database, API keys, etc.
2. **Config Files** (`config/default.json`) - Shop settings, theme, extensions

### Environment Variables

Create a `.env` file (use `../scripts/setup-evershop.sh` to generate):

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=josemadridsalsa
DB_USER=your_user
DB_PASSWORD=your_password
DB_SCHEMA=evershop

# Server
PORT=3001
HOST=localhost

# Security
EVERSHOP_API_KEY=<your_key>
SESSION_SECRET=<your_secret>
```

## Available Scripts

From the **main project root**:
```bash
npm run evershop:setup   # Initial setup (generates .env)
npm run evershop:dev     # Start development server
npm run evershop:build   # Build for production
npm run evershop:start   # Start production server
```

From **this directory**:
```bash
npm run setup    # Initialize database and create admin user
npm run dev      # Start dev server on port 3001
npm run build    # Build assets
npm start        # Start production server
```

## Integration Points

### 1. Order Sync (Next.js → EverShop)
When an order is created in the Next.js storefront, it's automatically synced to EverShop via:
- API endpoint: `POST /api/evershop/sync-order`
- Located at: `../app/api/evershop/sync-order/route.ts`

### 2. Status Updates (EverShop → Next.js)
When order status changes in EverShop (shipped, delivered), webhooks notify Next.js:
- Webhook endpoint: `POST /api/webhooks/evershop/order-updated`
- Located at: `../app/api/webhooks/evershop/order-updated/route.ts`

### 3. API Client
The Next.js app uses a client library to communicate with EverShop:
- Client: `../lib/evershop/client.ts`
- Handles order transformation and API calls

## Database Schema

EverShop uses a **separate schema** (`evershop`) in the same PostgreSQL database as the Next.js app:
- Next.js: `public` schema (managed by Prisma)
- EverShop: `evershop` schema (managed by EverShop migrations)

This approach allows:
- Shared database instance
- Isolated data
- Potential for cross-schema queries if needed

## Admin Panel

Access the EverShop admin panel at:
- URL: `http://localhost:3001/admin`
- Default credentials (set during setup):
  - Email: `admin@josemadridsalsa.com`
  - Password: (set in `.env`)

Features:
- View and manage orders
- Create shipping labels
- Track fulfillment
- Manage inventory
- Configure shipping methods
- Set up payment gateways

## Customization

### Extensions

Add custom functionality by creating extensions in `extensions/`:
```
extensions/
└── my-extension/
    ├── package.json
    └── bootstrap.js
```

Enable in `config/default.json`:
```json
{
  "system": {
    "extensions": [
      {
        "name": "my-extension",
        "resolve": "extensions/my-extension",
        "enabled": true
      }
    ]
  }
}
```

### Themes

Customize the look (if exposing EverShop frontend) in `themes/`:
```
themes/
└── my-theme/
    ├── package.json
    └── pages/
```

Set in `config/default.json`:
```json
{
  "system": {
    "theme": "my-theme"
  }
}
```

## Troubleshooting

### Database Connection Errors
Check your `.env` file has correct credentials and the `evershop` schema exists:
```bash
psql -h localhost -U your_user -d josemadridsalsa -c '\dn'
```

### Port Already in Use
If port 3001 is taken, change it in `.env`:
```bash
PORT=3002
```
And update `EVERSHOP_API_URL` in the main `.env.local`

### Module Not Found
Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Documentation

- **Integration Guide**: `../docs/evershop-integration.md`
- **Quick Start**: `../docs/evershop-quickstart.md`
- **EverShop Docs**: https://docs.evershop.io/
- **API Reference**: https://docs.evershop.io/api/

## Support

For integration issues, check the main project documentation or logs in the Next.js app.

For EverShop-specific questions:
- GitHub: https://github.com/evershopcommerce/evershop
- Discord: https://discord.gg/evershop
- Docs: https://docs.evershop.io/
