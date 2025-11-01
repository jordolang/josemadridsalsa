import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { sendPasswordResetEmail } from '@/lib/email'

const ForgotPasswordSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = ForgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      // Still return success to avoid email enumeration
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      })
    }

    const { email } = parsed.data

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    })

    // Always return the same response to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      })
    }

    // Delete any existing reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex')

    // Hash the token for storage
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    // Set expiration to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    // Store the hashed token in the database
    await prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt,
      },
    })

    // Send the reset email with the raw (unhashed) token
    await sendPasswordResetEmail(user.email, token)

    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('Password reset request error:', error)
    // Still return success to avoid leaking information
    return NextResponse.json({
      success: true,
      message: 'If an account exists with that email, a password reset link has been sent.',
    })
  }
}
