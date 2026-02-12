/**
 * Encryption Utility Tests
 * José Madrid Salsa E-commerce Platform
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt, isEncrypted, testEncryption } from '@/lib/encryption'

describe('Encryption Utility', () => {
  describe('encrypt', () => {
    it('should encrypt a plaintext string', () => {
      const plaintext = 'test-password-123'
      const encrypted = encrypt(plaintext)
      
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(plaintext)
      expect(encrypted.split(':')).toHaveLength(3) // iv:authTag:encrypted
    })

    it('should return empty string for empty input', () => {
      expect(encrypt('')).toBe('')
    })

    it('should produce different ciphertexts for same plaintext', () => {
      const plaintext = 'test-password'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)
      
      // Different IVs should produce different ciphertexts
      expect(encrypted1).not.toBe(encrypted2)
    })

    it('should encrypt special characters and symbols', () => {
      const plaintext = 'p@ssw0rd!#$%^&*()'
      const encrypted = encrypt(plaintext)
      
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(plaintext)
    })

    it('should encrypt long strings', () => {
      const plaintext = 'a'.repeat(1000)
      const encrypted = encrypt(plaintext)
      
      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(plaintext)
    })
  })

  describe('decrypt', () => {
    it('should decrypt an encrypted string back to original', () => {
      const plaintext = 'test-password-123'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should return empty string for empty input', () => {
      expect(decrypt('')).toBe('')
    })

    it('should decrypt special characters correctly', () => {
      const plaintext = 'p@ssw0rd!#$%^&*()'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should decrypt long strings correctly', () => {
      const plaintext = 'a'.repeat(1000)
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should throw error for invalid encrypted data format', () => {
      expect(() => decrypt('invalid-format')).toThrow()
    })

    it('should throw error for tampered data', () => {
      const plaintext = 'test-password'
      const encrypted = encrypt(plaintext)
      
      // Tamper with the encrypted data
      const parts = encrypted.split(':')
      parts[2] = parts[2].replace(/A/g, 'B') // Modify encrypted part
      const tampered = parts.join(':')
      
      expect(() => decrypt(tampered)).toThrow()
    })
  })

  describe('isEncrypted', () => {
    it('should return true for encrypted strings', () => {
      const encrypted = encrypt('test-password')
      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('should return false for plaintext strings', () => {
      expect(isEncrypted('plaintext-password')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false)
    })

    it('should return false for strings without proper format', () => {
      expect(isEncrypted('not:encrypted:format')).toBe(false)
      expect(isEncrypted('onlyonepart')).toBe(false)
      expect(isEncrypted('two:parts')).toBe(false)
    })
  })

  describe('testEncryption', () => {
    it('should return true when encryption works correctly', () => {
      expect(testEncryption()).toBe(true)
    })
  })

  describe('roundtrip tests', () => {
    it('should handle multiple encrypt/decrypt cycles', () => {
      let value = 'original-password'
      
      // Encrypt and decrypt 10 times
      for (let i = 0; i < 10; i++) {
        const encrypted = encrypt(value)
        value = decrypt(encrypted)
      }
      
      expect(value).toBe('original-password')
    })

    it('should handle unicode characters', () => {
      const plaintext = '密码🔐测试'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should handle multiline strings', () => {
      const plaintext = 'line1\nline2\nline3'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should handle JSON strings', () => {
      const plaintext = JSON.stringify({ password: 'test', user: 'admin' })
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
      expect(JSON.parse(decrypted)).toEqual({ password: 'test', user: 'admin' })
    })
  })

  describe('edge cases', () => {
    it('should handle whitespace-only strings', () => {
      const plaintext = '   '
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should handle single character', () => {
      const plaintext = 'a'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })

    it('should handle numbers as strings', () => {
      const plaintext = '123456789'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)
      
      expect(decrypted).toBe(plaintext)
    })
  })
})
