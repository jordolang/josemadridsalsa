import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return Buffer.from(key, 'hex')
}

export function encryptValue(plaintext: string): {
  encValue: string
  encIv: string
  encTag: string
} {
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const tag = cipher.getAuthTag()

  return {
    encValue: encrypted,
    encIv: iv.toString('base64'),
    encTag: tag.toString('base64'),
  }
}

export function decryptValue(encValue: string, encIv: string, encTag: string): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(encIv, 'base64')
  const tag = Buffer.from(encTag, 'base64')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encValue, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
