import { NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    // Validate token exists and is a hex string
    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json({ valid: false })
    }

    // Hash the token to match database storage
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Find a non-expired token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token: hashedToken,
        expiresAt: {
          gte: new Date(),
        },
      },
    })

    return NextResponse.json({ valid: !!resetToken })
  } catch (error) {
    console.error('Token verification error:', error)
    return NextResponse.json({ valid: false })
  }
}
