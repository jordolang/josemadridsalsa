# NextAuth Production Configuration

## Critical Environment Variables for Production

When deploying to production (Vercel, Netlify, or any other hosting platform), you MUST set the following environment variables:

### Required Variables

1. **NEXTAUTH_SECRET**
   - **Purpose**: Used to encrypt JWT tokens and session data
   - **Value**: Use the same secret from your local `.env` file
   - **Example**: `71d6c19fd251388a9cb6012840460b546f6c411f4ea8b2efad6b1e7881a4eb2c`
   - **Generate new**: `openssl rand -hex 32`

2. **NEXTAUTH_URL**
   - **Purpose**: The canonical URL of your site
   - **Local**: `http://localhost:3000`
   - **Production**: `https://www.josemadrid.net`
   - **Note**: NextAuth can auto-detect this in most cases, but setting it explicitly prevents issues

3. **DATABASE_URL**
   - **Purpose**: Connection string for your PostgreSQL database
   - **Value**: Your production database connection string
   - **Example**: `postgres://user:pass@host:5432/dbname?sslmode=require`

## Vercel Environment Variables Setup

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add the following variables for **Production** environment:

```
NEXTAUTH_SECRET=71d6c19fd251388a9cb6012840460b546f6c411f4ea8b2efad6b1e7881a4eb2c
NEXTAUTH_URL=https://www.josemadrid.net
DATABASE_URL=your_production_database_url
```

## Common Issues and Fixes

### Issue: CLIENT_FETCH_ERROR with "The string did not match the expected pattern"

**Cause**: The `/api/auth/session` endpoint is returning HTML (from a 500 error) instead of JSON.

**Common Reasons**:
1. `NEXTAUTH_SECRET` not set in production environment
2. `NEXTAUTH_URL` pointing to localhost instead of production domain
3. Database connection issues
4. Cookie security settings incompatible with production

**Fix**:
- Ensure all environment variables are set in Vercel
- Verify `NEXTAUTH_URL` matches your production domain
- Check database connectivity from production environment
- Ensure `useSecureCookies` is set to `true` for production (already configured)

### Issue: Session not persisting after login

**Cause**: Cookie settings or domain mismatch

**Fix**:
- Verify `NEXTAUTH_URL` exactly matches your site URL (including https://)
- Check browser cookies are enabled
- Ensure your domain allows cookies (no browser restrictions)

### Issue: 500 errors on auth routes

**Cause**: Unhandled errors in auth callbacks or missing configuration

**Fix**:
- Check Vercel function logs for detailed error messages
- Verify database schema is up to date (`npx prisma migrate deploy`)
- Ensure all required environment variables are set

## Testing Production Configuration

After deploying:

1. **Check session endpoint**:
   ```bash
   curl https://www.josemadrid.net/api/auth/session
   ```
   Should return `{}` or a valid session JSON (not HTML)

2. **Check providers endpoint**:
   ```bash
   curl https://www.josemadrid.net/api/auth/providers
   ```
   Should return provider configuration JSON

3. **Test login flow**:
   - Navigate to your site
   - Open browser console
   - Attempt to sign in
   - Check for any console errors
   - Verify session is established

## Recent Fixes Applied

1. **Added error handling wrapper** to NextAuth route handler to ensure errors return JSON instead of HTML
2. **Added NEXTAUTH_URL logging** to help debug configuration issues
3. **Enabled secure cookies** for production environment
4. **Improved error logging** in auth callbacks

## Next Steps

1. Redeploy your application to Vercel
2. Verify all environment variables are set correctly
3. Test the login flow
4. Monitor Vercel function logs for any errors

## Support

If you continue to experience issues:
- Check Vercel function logs: Vercel Dashboard → Functions → [Your Function] → Logs
- Enable debug mode temporarily: Set `debug: true` in `lib/auth.ts` (but disable before committing)
- Check browser network tab for the exact response from `/api/auth/session`
