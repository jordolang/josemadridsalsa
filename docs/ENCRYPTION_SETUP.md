# Encryption Setup Guide

**José Madrid Salsa E-commerce Platform**

This guide explains how to configure and use the encryption features for securing sensitive data like SMTP passwords.

---

## Overview

The platform uses AES-256-GCM encryption to protect sensitive configuration data stored in the database, specifically:

- **SMTP passwords** in email configurations
- Other sensitive settings that may be added in the future

---

## Environment Setup

### 1. Generate an Encryption Key

Generate a secure random encryption key for production:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

This will output a base64-encoded string like:
```
xK8pN2mQ... (truncated for security)
```

### 2. Add to Environment Variables

Add the key to your `.env.local` or production environment:

```env
ENCRYPTION_KEY="your_generated_key_here"
```

**Important Security Notes:**
- ✅ **DO** use a strong, randomly generated key
- ✅ **DO** store the key securely (use environment variables, never commit to Git)
- ✅ **DO** use different keys for development, staging, and production
- ❌ **DO NOT** commit encryption keys to version control
- ❌ **DO NOT** share encryption keys in documentation or chat

### 3. Development vs Production

**Development:**
- If `ENCRYPTION_KEY` is not set, the system uses a default key with a warning
- This is acceptable for local development only
- You'll see a console warning: `[Encryption] Using default key for development`

**Production:**
- `ENCRYPTION_KEY` is **required** in production
- The system will throw an error if the key is missing
- Use your hosting provider's environment variable management

---

## How It Works

### Encryption Process

1. Admin enters SMTP password in email configuration form
2. Password is encrypted using AES-256-GCM before database storage
3. Encrypted format: `iv:authTag:encryptedData` (base64-encoded)

### Decryption Process

1. System retrieves encrypted password from database
2. Password is decrypted when needed for SMTP connection
3. Decrypted value is used temporarily in memory, never logged

### Security Features

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Authentication**: GCM provides built-in authentication tags
- **Key Derivation**: Uses scrypt to derive 32-byte keys from environment variable
- **Random IVs**: Each encryption uses a unique initialization vector

---

## Usage

### Email Configuration

When configuring SMTP settings in the admin panel:

1. Navigate to **Admin → Settings → Email**
2. Add new email configuration
3. Enter SMTP credentials:
   - Host, Port, Username
   - **Password** (automatically encrypted on save)
   - Security settings (SSL/TLS)
4. Click **Test Connection** to verify
5. Save configuration

The SMTP password is automatically:
- ✅ Encrypted before storage
- ✅ Decrypted when testing connections
- ✅ Decrypted when sending emails

### API Usage

If you need to use encryption in your own code:

```typescript
import { encrypt, decrypt, isEncrypted } from '@/lib/encryption'

// Encrypt sensitive data
const encryptedPassword = encrypt('my-secret-password')
// Returns: "iv:authTag:encrypted" format

// Decrypt when needed
const decryptedPassword = decrypt(encryptedPassword)
// Returns: "my-secret-password"

// Check if value is encrypted
const isAlreadyEncrypted = isEncrypted(someValue)
// Returns: boolean
```

---

## Key Rotation

If you need to rotate encryption keys (recommended annually):

### Step 1: Generate New Key
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Step 2: Migration Script
Create a migration script to re-encrypt data with the new key:

```typescript
// scripts/rotate-encryption-key.ts
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// Helper functions that accept key as parameter
function decryptWithKey(encryptedData: string, key: Buffer): string {
  const parts = encryptedData.split(':')
  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = parts[2]
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  
  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

// Derive keys from environment variables
const oldKey = crypto.scryptSync(
  process.env.OLD_ENCRYPTION_KEY!,
  crypto.createHash('sha256').update('jose-madrid-salsa-v1').digest(),
  32
)
const newKey = crypto.scryptSync(
  process.env.ENCRYPTION_KEY!,
  crypto.createHash('sha256').update('jose-madrid-salsa-v1').digest(),
  32
)

// Re-encrypt all data
const configs = await prisma.emailConfiguration.findMany()

for (const config of configs) {
  if (config.smtpPassword) {
    const decrypted = decryptWithKey(config.smtpPassword, oldKey)
    const reencrypted = encryptWithKey(decrypted, newKey)
    
    await prisma.emailConfiguration.update({
      where: { id: config.id },
      data: { smtpPassword: reencrypted },
    })
  }
}
```

### Step 3: Deploy New Key
1. Run migration script with both `OLD_ENCRYPTION_KEY` and `ENCRYPTION_KEY`
2. Verify all data is re-encrypted
3. Update production environment to use only `ENCRYPTION_KEY`
4. Delete `OLD_ENCRYPTION_KEY` from environment

---

## Troubleshooting

### Issue: "Failed to decrypt data" Error

**Causes:**
- Encryption key changed but data was not re-encrypted
- Database contains data encrypted with a different key
- Corrupted encrypted data

**Solutions:**
1. Check if `ENCRYPTION_KEY` matches the key used to encrypt the data
2. If key was rotated, run re-encryption migration
3. If data is corrupted, delete and re-enter the configuration

### Issue: "ENCRYPTION_KEY environment variable is required" Error

**Cause:** Production environment missing `ENCRYPTION_KEY`

**Solution:**
1. Generate a new encryption key
2. Add to production environment variables
3. Redeploy application

### Issue: Email sending fails after encryption setup

**Causes:**
- Existing unencrypted passwords in database
- Encryption/decryption mismatch

**Solutions:**
1. Delete existing email configurations
2. Re-create configurations (passwords will be encrypted automatically)
3. Test connection before saving

---

## Testing Encryption

Use the built-in test utility:

```typescript
import { testEncryption } from '@/lib/encryption'

const isWorking = testEncryption()
console.log('Encryption test:', isWorking ? 'PASSED' : 'FAILED')
```

This performs a round-trip test:
1. Encrypts a test string
2. Decrypts the result
3. Verifies original value matches decrypted value

---

## Security Best Practices

1. ✅ **Use strong keys**: Always use cryptographically secure random keys
2. ✅ **Separate keys**: Use different keys for dev/staging/production
3. ✅ **Rotate keys**: Rotate encryption keys annually or after security incidents
4. ✅ **Backup keys**: Store encryption keys securely (password manager, secrets manager)
5. ✅ **Audit access**: Monitor who has access to encryption keys
6. ❌ **Never log**: Never log decrypted values or encryption keys
7. ❌ **Never commit**: Never commit keys to version control
8. ❌ **Never share**: Never share keys in chat, email, or documentation

---

## Related Documentation

- **Email Configuration Guide**: `docs/env-setup.md`
- **Environment Variables**: `.env.example`
- **SMTP Setup**: `docs/google-calendar-setup.md`

---

## Support

For issues related to encryption:
1. Check this documentation first
2. Review server logs for specific error messages
3. Verify environment variables are correctly set
4. Contact development team if issues persist
