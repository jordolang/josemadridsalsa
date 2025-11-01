# Authentication Fix Summary

**Date:** 2025-11-01  
**Issue:** Login was not working with database users; only hardcoded credentials were accepted

## Problem Identified

The NextAuth route handler at `app/api/auth/[...nextauth]/route.ts` was using a hardcoded authentication configuration that only accepted:
- Email: `admin@josemadridsalsa.com`
- Password: `admin123`

This prevented all database users (including the admin account with password `admin123456`) from logging in.

## Root Cause

Two authentication configurations existed in the codebase:
1. **Hardcoded config** in `app/api/auth/[...nextauth]/route.ts` - Wrong, basic setup
2. **Database-backed config** in `lib/auth.ts` - Correct, uses Prisma + bcrypt

The NextAuth route was using the wrong one (#1 instead of #2).

## Changes Made

### 1. Updated NextAuth Route Handler
**File:** `app/api/auth/[...nextauth]/route.ts`

**Before:**
```ts
import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Hardcoded credentials - WRONG!
        if (credentials?.email === "admin@josemadridsalsa.com" && 
            credentials?.password === "admin123") {
          return {
            id: "1",
            email: "admin@josemadridsalsa.com",
            name: "Admin User"
          }
        }
        return null
      }
    })
  ],
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup'
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
})

export { handler as GET, handler as POST }
```

**After:**
```ts
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
```

### 2. Cleaned Up Environment Variables
**File:** `.env`

**Removed duplicates:**
- Removed duplicate `NEXTAUTH_URL` entries (was defined twice with conflicting ports)
- Removed duplicate `NEXTAUTH_SECRET` entries
- Generated a strong secret using crypto

**Current values:**
```env
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="71d6c19fd251388a9cb6012840460b546f6c411f4ea8b2efad6b1e7881a4eb2c"
```

### 3. Regenerated Prisma Client
```bash
npx prisma generate
```

## How Authentication Now Works

1. User submits email/password via `/auth/signin`
2. NextAuth calls the `authorize` function in `lib/auth.ts`
3. System looks up user in database via Prisma
4. Password is verified using bcrypt against stored hash
5. JWT token is created with user `id` and `role`
6. Session includes user data for authorization checks

## Next Steps Required

### Immediate Actions

1. **Restart the dev server** on port 3000:
   ```bash
   npm run dev:fast
   ```

2. **Clear browser cookies** for localhost:
   - Open DevTools → Application → Storage → Clear site data
   - Or visit: `http://localhost:3000/api/auth/signout`

3. **Test login** with database credentials:
   - Email: `admin@josemadridsalsa.com`
   - Password: `admin123456` (not `admin123`)

4. **Verify users in database** (optional):
   ```bash
   npx prisma studio
   ```
   - Check that users have bcrypt-hashed passwords (start with `$2a$` or `$2b$`)
   - Verify the `role` field is set correctly

### Testing Checklist

- [ ] Log in with `admin@josemadridsalsa.com` / `admin123456`
- [ ] Verify redirect to admin dashboard
- [ ] Check `/api/auth/session` returns user data with `id` and `role`
- [ ] Test logout functionality
- [ ] Try other database user accounts (if any exist)

### Production Deployment

When deploying to Vercel:

1. **Set environment variables:**
   - `NEXTAUTH_URL`: Your production domain (e.g., `https://josemadridsalsa.com`)
   - `NEXTAUTH_SECRET`: Same strong secret (or generate a new one for production)
   - `DATABASE_URL`: Your production database connection string

2. **Deploy and test:**
   - Clear cookies on production domain
   - Test login with database credentials
   - Verify admin panel access

## Additional User Management

### Creating New Admin Users

**Option 1: Using the script (recommended)**
```bash
npm run create-admin
```

Default credentials:
- Email: `admin@josemadridsalsa.com`
- Password: `admin123456`

Custom credentials:
```bash
ADMIN_EMAIL=youremail@example.com \
ADMIN_PASSWORD=yourpassword \
ADMIN_NAME="Your Name" \
npm run create-admin
```

**Option 2: Using Prisma Studio**
```bash
npx prisma studio
```
1. Open `User` model
2. Click "Add record"
3. Fill in email, name, and bcrypt-hashed password
4. Set `role` to `ADMIN`
5. Set `isEmailVerified` to `true`

To generate a bcrypt hash:
```bash
node -e "require('bcryptjs').hash('yourpassword',10).then(console.log)"
```

### Creating Customer Accounts

Users can register at `/auth/signup` with:
- Email
- Password (will be hashed automatically)
- Name

Default role will be `CUSTOMER` with limited access.

## Security Notes

⚠️ **Important:**
- The old hardcoded credentials (`admin123`) are no longer valid
- All passwords are now bcrypt-hashed in the database
- Never commit `.env` or `.env.local` to version control
- Change default passwords after first login
- Use strong, unique secrets for production

## Technical Details

### Authentication Flow
- **Adapter:** `@auth/prisma-adapter` - Manages sessions and accounts
- **Password Hashing:** `bcryptjs` - Secures passwords with salted hashing
- **Session Strategy:** JWT - Stateless authentication with signed tokens
- **Database:** PostgreSQL via Prisma - User records stored in `users` table

### Key Files
- `lib/auth.ts` - Main authentication configuration
- `app/api/auth/[...nextauth]/route.ts` - NextAuth API route
- `app/auth/signin/page.tsx` - Sign-in UI component
- `prisma/schema.prisma` - User model definition

## Troubleshooting

### "Invalid email or password" Error

**Causes:**
1. User doesn't exist in database
2. Password is incorrect
3. Password field is empty or not properly hashed
4. Stale cookies from old configuration

**Solutions:**
1. Verify user exists: `npx prisma studio`
2. Check password hash starts with `$2a$` or `$2b$`
3. Clear browser cookies and try again
4. Restart dev server after env changes

### Session Not Persisting

**Check:**
1. `NEXTAUTH_SECRET` is set in `.env`
2. `NEXTAUTH_URL` matches your current URL
3. Dev server is running on the correct port (3000)
4. No browser extensions blocking cookies

### Can't Access Admin Panel

**Check:**
1. User `role` is set to `ADMIN` or `DEVELOPER` in database
2. Session includes `role` field (check `/api/auth/session`)
3. Middleware is not blocking the route

## Commit Message

```
fix(auth): switch NextAuth route to database-backed authOptions and remove hardcoded credentials

- Replace hardcoded auth config with database-backed configuration from lib/auth.ts
- Clean up duplicate NEXTAUTH_URL and NEXTAUTH_SECRET environment variables
- Generate strong secret for NEXTAUTH_SECRET
- Regenerate Prisma client
- All database users can now log in with bcrypt-hashed passwords
- Hardcoded admin123 credentials no longer valid
```

## Related Documentation

- `docs/ADMIN_LOGIN_GUIDE.md` - Admin panel access guide
- `scripts/create-admin.ts` - Admin user creation script
- `lib/auth.ts` - Authentication configuration
- `prisma/schema.prisma` - User model schema
