import { z } from 'zod'
import Papa from 'papaparse'
import { prisma } from '@/lib/prisma'
import { GiftCertificateTheme } from '@prisma/client'

export const GiftCertificateImportSchema = z.object({
  code: z.string().optional(),
  originalAmount: z.coerce.number().min(0),
  balance: z.coerce.number().min(0).optional(),
  purchaserName: z.string().min(1),
  purchaserEmail: z.string().email(),
  recipientName: z.string().min(1),
  recipientEmail: z.string().email().optional(),
  theme: z.enum(['BIRTHDAY', 'BOY_CELEBRATION', 'CHRISTMAS', 'GENERAL', 'GIRL']).default('GENERAL'),
  message: z.string().optional(),
  expiresAt: z.string().optional(),
})

export type GiftCertificateImportRow = z.infer<typeof GiftCertificateImportSchema>

export async function generateGiftCertificateCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code: string
  let exists = true

  while (exists) {
    const part1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    const part2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    code = `JMS-GC-${part1}-${part2}`

    const existing = await prisma.giftCertificate.findUnique({
      where: { code },
    })
    exists = !!existing
  }

  return code!
}

export async function importGiftCertificates(rows: any[]): Promise<{
  success: number
  errors: Array<{ row: number; message: string }>
}> {
  const result = {
    success: 0,
    errors: [] as Array<{ row: number; message: string }>,
  }

  for (let i = 0; i < rows.length; i++) {
    try {
      const validated = GiftCertificateImportSchema.parse(rows[i])
      const code = validated.code || (await generateGiftCertificateCode())

      await prisma.giftCertificate.create({
        data: {
          code,
          originalAmount: validated.originalAmount,
          balance: validated.balance ?? validated.originalAmount,
          purchaserName: validated.purchaserName,
          purchaserEmail: validated.purchaserEmail,
          recipientName: validated.recipientName,
          recipientEmail: validated.recipientEmail,
          theme: validated.theme as GiftCertificateTheme,
          message: validated.message,
          expiresAt: validated.expiresAt ? new Date(validated.expiresAt) : undefined,
        },
      })

      result.success++
    } catch (error) {
      result.errors.push({
        row: i + 2,
        message: String(error),
      })
    }
  }

  return result
}

export async function exportGiftCertificates(filters?: {
  status?: string
  dateFrom?: Date
  dateTo?: Date
}): Promise<string> {
  const certificates = await prisma.giftCertificate.findMany({
    where: {
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.dateFrom && {
        createdAt: { gte: filters.dateFrom },
      }),
    },
    include: {
      usages: true,
    },
  })

  const csvData = certificates.map((cert) => ({
    code: cert.code,
    originalAmount: cert.originalAmount.toString(),
    balance: cert.balance.toString(),
    purchaserName: cert.purchaserName,
    purchaserEmail: cert.purchaserEmail,
    recipientName: cert.recipientName,
    recipientEmail: cert.recipientEmail || '',
    theme: cert.theme,
    status: cert.status,
    usageCount: cert.usages.length,
    createdAt: cert.createdAt.toISOString(),
    expiresAt: cert.expiresAt?.toISOString() || '',
  }))

  return Papa.unparse(csvData)
}
