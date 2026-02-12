/**
 * Encryption Utility
 * Provides encryption/decryption for sensitive data like SMTP passwords
 * José Madrid Salsa E-commerce Platform
 */

import crypto from 'crypto'

// Encryption configuration
const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 16 bytes for AES
const AUTH_TAG_LENGTH = 16 // 16 bytes for GCM authentication tag

/**
 * Get encryption key from environment
 * In production, this should be a strong, randomly generated key stored securely
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    // Development fallback - DO NOT use in production
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required in production'
      )
    }
    console.warn(
      '[Encryption] Using default key for development. Set ENCRYPTION_KEY in production!'
    )
    // Generate a session-specific key for development to avoid predictable patterns
    const devKey = `dev-${Date.now()}-${Math.random()}`
    return crypto.scryptSync(devKey, crypto.randomBytes(16), 32)
  }
  
  // Derive a 32-byte key from the environment variable using scrypt
  // Use a consistent salt for key derivation - this is intentional and secure
  // because each encryption operation uses a unique random IV
  // The salt ensures the same ENCRYPTION_KEY always derives to the same key
  const salt = crypto.createHash('sha256').update('jose-madrid-salsa-v1').digest()
  return crypto.scryptSync(key, salt, 32)
}

/**
 * Encrypt a string value
 * Returns base64-encoded string: iv:authTag:encrypted
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    
    // Generate random initialization vector
    const iv = crypto.randomBytes(IV_LENGTH)
    
    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    // Encrypt the data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    
    // Get authentication tag (GCM mode)
    const authTag = cipher.getAuthTag()
    
    // Combine IV, auth tag, and encrypted data (separated by colons)
    const combined = `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
    
    return combined
  } catch (error) {
    console.error('[Encryption] Error encrypting data:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt an encrypted string
 * Expects base64-encoded string format: iv:authTag:encrypted
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    
    // Split the combined string
    const parts = encryptedData.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const encrypted = parts[2]
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'base64', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('[Encryption] Error decrypting data:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Check if a string is encrypted (basic heuristic)
 * Encrypted strings should have the format: base64:base64:base64
 */
export function isEncrypted(value: string): boolean {
  if (!value) {
    return false
  }
  
  const parts = value.split(':')
  if (parts.length !== 3) {
    return false
  }
  
  // Check if all parts look like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/
  return parts.every((part) => base64Regex.test(part))
}

/**
 * Generate a random encryption key for ENCRYPTION_KEY env variable
 * Use this to generate a secure key for production
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(64).toString('base64')
}

/**
 * Test encryption/decryption roundtrip
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test-password-123'
    const encrypted = encrypt(testData)
    const decrypted = decrypt(encrypted)
    
    return testData === decrypted && isEncrypted(encrypted)
  } catch (error) {
    console.error('[Encryption] Test failed:', error)
    return false
  }
}
