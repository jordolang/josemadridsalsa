import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const BalanceCheckSchema = z.object({
  code: z.string().min(1, 'Gift certificate code is required'),
})

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const parsed = BalanceCheckSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid gift certificate code.', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { code } = parsed.data

    const giftCertificate = await prisma.giftCertificate.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        usages: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        order: {
          select: {
            orderNumber: true,
            paymentStatus: true,
          },
        },
      },
    })

    if (!giftCertificate) {
      return NextResponse.json(
        { error: 'Gift certificate not found. Please check your code and try again.' },
        { status: 404 }
      )
    }

    // Check if expired
    if (giftCertificate.expiresAt && giftCertificate.expiresAt < new Date()) {
      return NextResponse.json({
        code: giftCertificate.code,
        originalAmount: Number(giftCertificate.originalAmount),
        balance: Number(giftCertificate.balance),
        status: giftCertificate.status,
        isExpired: true,
        expiresAt: giftCertificate.expiresAt,
        message: 'This gift certificate has expired.',
      })
    }

    // Check if already fully redeemed
    if (giftCertificate.status === 'REDEEMED' || Number(giftCertificate.balance) === 0) {
      return NextResponse.json({
        code: giftCertificate.code,
        originalAmount: Number(giftCertificate.originalAmount),
        balance: 0,
        status: 'REDEEMED',
        isRedeemed: true,
        message: 'This gift certificate has been fully redeemed.',
      })
    }

    return NextResponse.json({
      code: giftCertificate.code,
      originalAmount: Number(giftCertificate.originalAmount),
      balance: Number(giftCertificate.balance),
      status: giftCertificate.status,
      recipientName: giftCertificate.recipientName,
      expiresAt: giftCertificate.expiresAt,
      recentUsage: giftCertificate.usages.map((usage) => ({
        amount: Number(usage.amount),
        balanceAfter: Number(usage.balanceAfter),
        usedAt: usage.createdAt,
      })),
    })
  } catch (error) {
    console.error('Balance check error:', error)
    return NextResponse.json(
      { error: 'Unable to check gift certificate balance. Please try again.' },
      { status: 500 }
    )
  }
}

