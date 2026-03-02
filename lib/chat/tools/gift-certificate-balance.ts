import { prisma } from '@/lib/prisma'

export async function checkGiftCertificateBalance(code: string) {
  const certificate = await prisma.giftCertificate.findUnique({
    where: { code: code.toUpperCase() },
    include: {
      usages: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!certificate) {
    return {
      found: false,
      message: 'Gift certificate not found. Please check the code and try again.',
    }
  }

  if (certificate.status === 'EXPIRED') {
    return {
      found: true,
      valid: false,
      message: 'This gift certificate has expired.',
      expiresAt: certificate.expiresAt,
    }
  }

  if (certificate.status === 'CANCELLED') {
    return {
      found: true,
      valid: false,
      message: 'This gift certificate has been cancelled.',
    }
  }

  if (certificate.balance.toNumber() === 0) {
    return {
      found: true,
      valid: false,
      message: 'This gift certificate has been fully redeemed.',
      originalAmount: certificate.originalAmount.toString(),
      balance: '0.00',
    }
  }

  return {
    found: true,
    valid: true,
    code: certificate.code,
    balance: certificate.balance.toString(),
    originalAmount: certificate.originalAmount.toString(),
    status: certificate.status,
    expiresAt: certificate.expiresAt?.toISOString(),
    recentUsage: certificate.usages.map((usage) => ({
      date: usage.createdAt.toISOString(),
      amount: usage.amount.toString(),
    })),
  }
}
