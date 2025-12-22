import { prisma } from '@/lib/prisma'
import { decryptSecret } from '@/lib/crypto'

function normalizeKey(value: string) {
  return value.trim().toLowerCase()
}

export async function getDecryptedServiceKeyValue(serviceName: string, keyName: string) {
  const record = await prisma.serviceKey.findUnique({
    where: {
      serviceName_keyName: {
        serviceName: normalizeKey(serviceName),
        keyName: normalizeKey(keyName),
      },
    },
  })

  if (!record || !record.isActive) {
    return null
  }

  if (!record.encryptedValue || !record.iv) {
    return null
  }

  try {
    return decryptSecret(record.encryptedValue, record.iv)
  } catch (error) {
    console.error('[service-keys] Failed to decrypt secret', error)
    return null
  }
}

export async function hasActiveServiceKey(serviceName: string, keyName?: string) {
  if (keyName) {
    const record = await prisma.serviceKey.findUnique({
      where: {
        serviceName_keyName: {
          serviceName: normalizeKey(serviceName),
          keyName: normalizeKey(keyName),
        },
      },
    })
    return Boolean(record?.isActive)
  }

  const record = await prisma.serviceKey.findFirst({
    where: {
      serviceName: normalizeKey(serviceName),
      isActive: true,
    },
  })

  return Boolean(record)
}
