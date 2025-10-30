import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = RegisterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid registration data.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { email, password, name } = parsed.data
    const normalizedEmail = email.toLowerCase()

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    await prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    )
  }
}
