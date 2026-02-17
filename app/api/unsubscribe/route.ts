import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const UnsubscribeSchema = z.object({
  email: z.string().email(),
  categories: z.array(z.string()).optional(),
  unsubscribeAll: z.boolean().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = UnsubscribeSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 }
      )
    }

    const { email, categories, unsubscribeAll } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    // Find or create unsubscribe preference
    const existing = await prisma.unsubscribePreference.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      // Update existing preference
      await prisma.unsubscribePreference.update({
        where: { email: normalizedEmail },
        data: {
          unsubscribeAll: unsubscribeAll ?? existing.unsubscribeAll,
          unsubscribedFrom: categories ?? existing.unsubscribedFrom,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new preference
      await prisma.unsubscribePreference.create({
        data: {
          email: normalizedEmail,
          unsubscribeAll: unsubscribeAll ?? false,
          unsubscribedFrom: categories ?? [],
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Unsubscribe error:', error)
    return NextResponse.json(
      { error: 'Unable to process your request. Please try again later.' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required.' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    const preference = await prisma.unsubscribePreference.findUnique({
      where: { email: normalizedEmail },
    })

    if (!preference) {
      return NextResponse.json({
        unsubscribeAll: false,
        unsubscribedFrom: [],
      })
    }

    return NextResponse.json({
      unsubscribeAll: preference.unsubscribeAll,
      unsubscribedFrom: preference.unsubscribedFrom,
    })
  } catch (error) {
    console.error('Error fetching unsubscribe preference:', error)
    return NextResponse.json(
      { error: 'Unable to fetch preferences.' },
      { status: 500 }
    )
  }
}
