import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ResetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request. Password must be at least 8 characters.' },
        { status: 400 }
      )
    }

    const { token, password } = parsed.data

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

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token.' },
        { status: 400 }
      )
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Update the user's password
    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    })

    // Delete all reset tokens for this user to invalidate them
    await prisma.passwordResetToken.deleteMany({
      where: { userId: resetToken.userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Password reset error:', error)
    return NextResponse.json(
      { error: 'Unable to reset password. Please try again.' },
      { status: 500 }
    )
  }
}
