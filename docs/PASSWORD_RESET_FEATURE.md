# Password Reset Feature

## Overview
Complete password reset functionality for Jose Madrid Salsa e-commerce platform with secure token-based flow.

## Features Implemented

### Database Schema
- **PasswordResetToken Model**: Stores hashed reset tokens with expiration
  - SHA-256 hashed tokens for security
  - 1-hour expiration window
  - Automatic cleanup on use
  - Cascading delete when user is removed

### API Routes

#### POST `/api/auth/forgot-password`
Request a password reset link.
- **Input**: `{ email: string }`
- **Security**: Returns success regardless of email existence (prevents enumeration)
- **Action**: Sends branded email with reset link
- **Token**: Generates secure 32-byte random token

#### GET `/api/auth/verify-reset-token?token=...`
Validate a reset token before showing password form.
- **Input**: Token as query parameter
- **Output**: `{ valid: boolean }`
- **Validation**: Checks token format, existence, and expiration

#### POST `/api/auth/reset-password`
Reset password using valid token.
- **Input**: `{ token: string, password: string }`
- **Validation**: Password minimum 8 characters
- **Security**: Invalidates all user tokens after successful reset
- **Password Hashing**: bcrypt with 12 rounds

### UI Pages

#### `/auth/forgot-password`
- Email input form
- Success message after submission (generic to prevent enumeration)
- Link back to sign in
- Loading states and error handling

#### `/auth/reset-password?token=...`
- Token validation on page load
- Password strength indicator (Weak/Medium/Strong)
- Password visibility toggle
- Confirm password field with matching validation
- Success state with auto-redirect to sign in
- Error states for invalid/expired tokens

### Email Template
Branded HTML email with:
- Clear call-to-action button
- Fallback text link
- 1-hour expiration warning
- Security notice about ignoring if not requested
- Jose Madrid Salsa branding

## Security Features

1. **Token Hashing**: Tokens hashed with SHA-256 before database storage
2. **Email Enumeration Prevention**: Same response for existing/non-existing emails
3. **Token Expiration**: 1-hour validity window
4. **Single Use**: Tokens invalidated immediately after successful password reset
5. **Email Normalization**: Lowercase and trimmed for consistency
6. **Password Requirements**: Minimum 8 characters (configurable)
7. **HTTPS Only**: Reset links use NEXTAUTH_URL environment variable

## Environment Variables Required

```env
# Already configured in your .env file
NEXTAUTH_URL=http://localhost:3000  # Update for production
RESEND_API_KEY=re_...
FROM_EMAIL=orders@josemadridsalsa.com
```

## Testing Checklist

### Manual Testing
- [ ] Request reset for existing account → receive email
- [ ] Request reset for non-existent account → same success message
- [ ] Click reset link → opens reset page with valid token
- [ ] Enter weak password → see strength indicator
- [ ] Enter mismatched passwords → see error
- [ ] Successfully reset password → redirected to signin
- [ ] Use same token again → rejected as invalid
- [ ] Wait 1 hour and use token → rejected as expired
- [ ] Sign in with new password → successful

### Production Deployment
1. Ensure `NEXTAUTH_URL` is set to production domain
2. Verify `RESEND_API_KEY` is configured
3. Database migration will run automatically via `prisma db push` or migrations
4. Test email delivery in production
5. Monitor for any token cleanup issues (optional: add cron job to delete expired tokens)

## Future Enhancements (Optional)
- Rate limiting on forgot-password endpoint
- CAPTCHA integration for abuse prevention
- Scheduled job to clean up expired tokens
- Email template customization via admin panel
- Multi-language support for emails
- SMS-based password reset option
