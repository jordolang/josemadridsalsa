import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { code, cartTotal } = await request.json()

    if (!code) {
      return NextResponse.json(
        { error: 'Gift certificate code is required' },
        { status: 400 }
      )
    }

    const certificate = await prisma.giftCertificate.findUnique({
      where: { code: code.toUpperCase() },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Invalid gift certificate code' },
        { status: 404 }
      )
    }

    if (certificate.status === 'EXPIRED') {
      return NextResponse.json(
        { error: 'This gift certificate has expired' },
        { status: 400 }
      )
    }

    if (certificate.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'This gift certificate has been cancelled' },
        { status: 400 }
      )
    }

    if (certificate.balance.toNumber() === 0) {
      return NextResponse.json(
        { error: 'This gift certificate has been fully redeemed' },
        { status: 400 }
      )
    }

    const applicableAmount = Math.min(
      certificate.balance.toNumber(),
      parseFloat(cartTotal)
    )

    return NextResponse.json({
      success: true,
      code: certificate.code,
      balance: certificate.balance.toString(),
      applicableAmount: applicableAmount.toFixed(2),
      remainingBalance: (certificate.balance.toNumber() - applicableAmount).toFixed(2),
    })
  } catch (error) {
    console.error('Gift certificate application error:', error)
    return NextResponse.json(
      { error: 'Failed to apply gift certificate' },
      { status: 500 }
    )
  }
}
