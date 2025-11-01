import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16 // 128 bits
const AUTH_TAG_LENGTH = 16 // 128 bits
const KEY_LENGTH = 32 // 256 bits

/**
 * Get the master encryption key from environment
 * @throws {Error} if MASTER_KEY is not set or invalid
 */
function getMasterKey(): Buffer {
  const masterKey = process.env.MASTER_KEY

  if (!masterKey) {
    throw new Error('MASTER_KEY environment variable is not set')
  }

  // Expect a 64-character hex string (32 bytes)
  if (masterKey.length !== KEY_LENGTH * 2) {
    throw new Error(
      `MASTER_KEY must be ${KEY_LENGTH * 2} hex characters (${KEY_LENGTH} bytes)`
    )
  }

  try {
    return Buffer.from(masterKey, 'hex')
  } catch (error) {
    throw new Error('MASTER_KEY must be a valid hex string')
  }
}

/**
 * Encrypt a plaintext secret using AES-256-GCM
 * @param plaintext - The secret to encrypt
 * @returns Object containing encrypted value and initialization vector
 */
export function encryptSecret(plaintext: string): {
  encryptedValue: string
  iv: string
} {
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  const authTag = cipher.getAuthTag()
  
  // Combine encrypted data with auth tag
  const encryptedValue = encrypted + authTag.toString('hex')
  
  return {
    encryptedValue,
    iv: iv.toString('hex'),
  }
}

/**
 * Decrypt an encrypted secret using AES-256-GCM
 * @param encryptedValue - The encrypted value (includes auth tag)
 * @param iv - The initialization vector used during encryption
 * @returns The decrypted plaintext
 * @throws {Error} if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptSecret(encryptedValue: string, iv: string): string {
  const key = getMasterKey()
  
  // Split encrypted data and auth tag
  const authTag = Buffer.from(
    encryptedValue.slice(-AUTH_TAG_LENGTH * 2),
    'hex'
  )
  const encrypted = encryptedValue.slice(0, -AUTH_TAG_LENGTH * 2)
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex')
  )
  decipher.setAuthTag(authTag)
  
  try {
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (error) {
    throw new Error('Decryption failed - invalid key or tampered data')
  }
}

/**
 * Generate a secure random master key
 * Use this to generate MASTER_KEY for your environment
 * @returns A 64-character hex string
 */
export function generateMasterKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Hash a value using SHA-256 (one-way)
 * Useful for storing hashed tokens or verifying data integrity
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}
