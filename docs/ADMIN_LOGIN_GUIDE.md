# Admin Panel Login Guide

## Accessing the Admin Panel

The admin panel is located at: **`http://localhost:3000/admin`**

## Creating Your First Admin User

### Method 1: Using the Create Admin Script (Recommended)

Run this command to create an admin user:

```bash
npm run create-admin
```

**Default credentials:**
- Email: `admin@josemadridsalsa.com`
- Password: `admin123456`

**Custom credentials:**
```bash
ADMIN_EMAIL=youremail@example.com ADMIN_PASSWORD=yourpassword ADMIN_NAME="Your Name" npm run create-admin
```

### Method 2: Using Prisma Studio

1. Open Prisma Studio:
```bash
npm run db:studio
```

2. Navigate to the `User` model

3. Click "Add record"

4. Fill in:
   - **email**: your email address
   - **name**: your name
   - **password**: use a bcrypt hash (see below)
   - **role**: `ADMIN`
   - **isEmailVerified**: `true`

**To generate a bcrypt hash for your password:**
```bash
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
```

### Method 3: Direct Database Insert

Using PostgreSQL client:

```sql
INSERT INTO users (id, email, name, password, role, "isEmailVerified", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'admin@example.com',
  'Admin User',
  '$2a$10$HASH_HERE', -- Use bcrypt hash
  'ADMIN',
  true,
  NOW(),
  NOW()
);
```

## Logging In

1. Start the development server:
```bash
npm run dev
```

2. Navigate to: `http://localhost:3000/admin`

3. You'll be redirected to the login page if not authenticated

4. Enter your admin credentials

5. You'll be redirected to the admin dashboard

## Admin Panel Features

Once logged in, you'll have access to:

### ✅ Content Management
- **Products** - Manage salsa products, inventory, pricing
- **Recipes** - Create and edit recipes
- **Categories** - Organize products
- **Tags** - Universal tagging system
- **Media Library** - Manage images and assets

### ✅ User Management
- **Users** - Create and manage user accounts
- **Audit Logs** - View all system activity

### ✅ Operations
- **Dashboard** - Overview metrics and charts
- **Orders** - View and manage orders

### ✅ Store Features
- **Fundraisers** - View fundraising campaigns
- **Wholesale** - Manage wholesale applications

## User Roles

| Role | Access Level |
|------|-------------|
| **ADMIN** | Full access to admin panel |
| **DEVELOPER** | System-level access |
| **STAFF** | Limited admin access |
| **WHOLESALE** | Storefront + bulk pricing |
| **CUSTOMER** | Storefront only |

## Security Notes

### ⚠️ Important Security Steps

1. **Change Default Password**
   - If you used the default password, change it immediately
   - Go to Admin Panel → Users → Edit your user

2. **Use Strong Passwords**
   - Minimum 8 characters
   - Mix of letters, numbers, and symbols

3. **Email Verification**
   - Ensure `isEmailVerified` is set to `true` for admin users

4. **Production Deployment**
   - Never commit credentials to Git
   - Use environment variables for admin creation
   - Set up proper SSL/TLS
   - Configure NEXTAUTH_SECRET in `.env`

## Troubleshooting

### "Access Denied" or Redirected Back to Login

**Check:**
1. User exists in database
2. User role is set to `ADMIN` or `DEVELOPER`
3. NextAuth session is working
4. `NEXTAUTH_SECRET` is set in `.env`
5. `NEXTAUTH_URL` matches your URL

### Cannot Access Certain Pages

**Check:**
- Your user has the required permissions
- Staff roles have limited access - use ADMIN role for full access

### Session Expires Quickly

**Update `.env`:**
```env
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

## Permission System

The admin panel uses role-based access control (RBAC):

### Permission Categories
- `orders:read` / `orders:write` - Order management
- `products:read` / `products:write` - Product catalog
- `content:read` / `content:write` - Content management
- `users:read` / `users:write` - User management
- `analytics:read` - Reports and analytics
- `settings:read` / `settings:write` - System configuration

### Role Permissions (Default)

**ADMIN / DEVELOPER:**
- Full access to all permissions

**STAFF:**
- orders:read, products:read, content:read
- Limited write access

**CUSTOMER / WHOLESALE:**
- No admin panel access

## Environment Variables

Required for admin panel to work:

```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Stripe (for payments)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

## Quick Start Checklist

- [ ] Database is set up and migrated
- [ ] `.env` file is configured
- [ ] Admin user is created
- [ ] Development server is running
- [ ] Navigate to `/admin`
- [ ] Log in with credentials
- [ ] Change default password
- [ ] Configure permissions if needed

## Need Help?

Check the documentation:
- `docs/admin-panel-complete.md` - Complete overview
- `docs/phase2-complete.md` - Content management details
- `docs/phase3-complete.md` - User management details

## Next Steps After Login

1. **Set Up Categories**
   - Go to Admin → Categories
   - Create product categories

2. **Add Products**
   - Go to Admin → Products
   - Create your first products

3. **Configure Users**
   - Go to Admin → Users
   - Set up staff accounts if needed

4. **Review Audit Logs**
   - Go to Admin → Audit Logs
   - Monitor all system activity

---

**Admin Panel URL:** `http://localhost:3000/admin`  
**Default Admin Email:** `admin@josemadridsalsa.com`  
**Default Password:** `admin123456` (change immediately!)
