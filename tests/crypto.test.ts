import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { encryptSecret, decryptSecret, generateMasterKey, hashValue } from '@/lib/crypto'

describe('Crypto Utilities', () => {
  const originalMasterKey = process.env.MASTER_KEY

  beforeEach(() => {
    // Set a test master key
    process.env.MASTER_KEY = generateMasterKey()
  })

  afterEach(() => {
    // Restore original
    process.env.MASTER_KEY = originalMasterKey
  })

  describe('encryptSecret and decryptSecret', () => {
    it('should encrypt and decrypt a secret correctly', () => {
      const plaintext = 'my-secret-api-key'
      const { encryptedValue, iv } = encryptSecret(plaintext)

      expect(encryptedValue).toBeTruthy()
      expect(iv).toBeTruthy()
      expect(encryptedValue).not.toBe(plaintext)

      const decrypted = decryptSecret(encryptedValue, iv)
      expect(decrypted).toBe(plaintext)
    })

    it('should produce different encrypted values for same plaintext', () => {
      const plaintext = 'my-secret'
      const result1 = encryptSecret(plaintext)
      const result2 = encryptSecret(plaintext)

      expect(result1.encryptedValue).not.toBe(result2.encryptedValue)
      expect(result1.iv).not.toBe(result2.iv)

      // But both should decrypt correctly
      expect(decryptSecret(result1.encryptedValue, result1.iv)).toBe(plaintext)
      expect(decryptSecret(result2.encryptedValue, result2.iv)).toBe(plaintext)
    })

    it('should fail to decrypt with wrong key', () => {
      const plaintext = 'secret-data'
      const { encryptedValue, iv } = encryptSecret(plaintext)

      // Change the key
      process.env.MASTER_KEY = generateMasterKey()

      expect(() => {
        decryptSecret(encryptedValue, iv)
      }).toThrow('Decryption failed')
    })

    it('should fail to decrypt tampered data', () => {
      const plaintext = 'secret-data'
      const { encryptedValue, iv } = encryptSecret(plaintext)

      // Tamper with the encrypted value
      const tampered = encryptedValue.slice(0, -2) + 'XX'

      expect(() => {
        decryptSecret(tampered, iv)
      }).toThrow('Decryption failed')
    })

    it('should handle empty strings', () => {
      const plaintext = ''
      const { encryptedValue, iv } = encryptSecret(plaintext)
      const decrypted = decryptSecret(encryptedValue, iv)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000)
      const { encryptedValue, iv } = encryptSecret(plaintext)
      const decrypted = decryptSecret(encryptedValue, iv)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*(){}[]|\\:";\'<>?,./~`'
      const { encryptedValue, iv } = encryptSecret(plaintext)
      const decrypted = decryptSecret(encryptedValue, iv)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters', () => {
      const plaintext = '🔐 秘密 مفتاح 🗝️'
      const { encryptedValue, iv } = encryptSecret(plaintext)
      const decrypted = decryptSecret(encryptedValue, iv)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('generateMasterKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateMasterKey()
      expect(key).toHaveLength(64)
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true)
    })

    it('should generate unique keys', () => {
      const key1 = generateMasterKey()
      const key2 = generateMasterKey()
      expect(key1).not.toBe(key2)
    })
  })

  describe('hashValue', () => {
    it('should hash a value consistently', () => {
      const value = 'test-value'
      const hash1 = hashValue(value)
      const hash2 = hashValue(value)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 produces 64 hex chars
    })

    it('should produce different hashes for different values', () => {
      const hash1 = hashValue('value1')
      const hash2 = hashValue('value2')

      expect(hash1).not.toBe(hash2)
    })

    it('should be one-way (cannot reverse)', () => {
      const value = 'secret'
      const hash = hashValue(value)

      // Hash should not contain original value
      expect(hash).not.toContain(value)
      expect(hash).toHaveLength(64)
    })
  })

  describe('MASTER_KEY validation', () => {
    it('should throw if MASTER_KEY is not set', () => {
      delete process.env.MASTER_KEY

      expect(() => {
        encryptSecret('test')
      }).toThrow('MASTER_KEY environment variable is not set')
    })

    it('should throw if MASTER_KEY is wrong length', () => {
      process.env.MASTER_KEY = 'short'

      expect(() => {
        encryptSecret('test')
      }).toThrow('MASTER_KEY must be 64 hex characters')
    })

    it('should throw if MASTER_KEY is not valid hex', () => {
      process.env.MASTER_KEY = 'z'.repeat(64)

      expect(() => {
        encryptSecret('test')
      }).toThrow('MASTER_KEY must be a valid hex string')
    })
  })
})
