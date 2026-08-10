import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { logEngagementRequest } from '@/lib/engagements'

const FundraiserRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  organizationName: z.string().min(2).max(200),
  contactPhone: z.string().optional(),
})

function generateSubdomain(orgName: string): string {
  const base = orgName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)

  if (base) {
    return base
  }

  // Fallback if sanitization removes all characters (e.g., only emoji/punctuation)
  const randomSuffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return `fundraiser-${randomSuffix}`.slice(0, 50)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = FundraiserRegisterSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid registration data.',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const { email, password, name, organizationName, contactPhone } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

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

    // Generate a unique subdomain and slug from the org name
    const baseSubdomain = generateSubdomain(organizationName)
    let subdomain = baseSubdomain
    let slug = baseSubdomain
    let attempt = 0

    // Ensure both subdomain and slug are unique; retry with random suffix if needed
    while (true) {
      const existingFundraiser = await prisma.fundraiser.findFirst({
        where: {
          OR: [{ subdomain }, { slug }],
        },
        select: { id: true },
      })

      if (!existingFundraiser) {
        break
      }

      attempt += 1
      const randomSuffix = `${Date.now().toString(36).slice(-4)}${Math.random()
        .toString(36)
        .slice(2, 6)}`
      const withSuffix = `${baseSubdomain}-${randomSuffix}`
      subdomain = withSuffix.slice(0, 50)
      slug = subdomain
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    // Create user, fundraiser, and account in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          password: hashedPassword,
          role: 'FUNDRAISER',
          phone: contactPhone,
        },
      })

      const now = new Date()
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

      const fundraiser = await tx.fundraiser.create({
        data: {
          name: organizationName,
          slug,
          subdomain,
          organizationName,
          contactEmail: normalizedEmail,
          contactPhone,
          startDate: now,
          endDate: thirtyDaysLater,
          // Standard terms: a $10 jar splits $5 to the group and $5 to us. The fundraiser
          // starts as a DRAFT, so this is reviewed before anything sells.
          commissionRate: 50,
          status: 'DRAFT',
          isActive: false,
        },
      })

      const account = await tx.fundraiserAccount.create({
        data: {
          userId: user.id,
          fundraiserId: fundraiser.id,
          status: 'PENDING',
        },
      })

      return { user, fundraiser, account }
    })

    await Promise.allSettled([
      logEngagementRequest({
        type: 'SIGNUP',
        email: normalizedEmail,
        name,
        source: 'auth:fundraiser-register',
        metadata: {
          channel: 'web',
          organizationName,
          fundraiserId: result.fundraiser.id,
        },
      }),
    ])

    return NextResponse.json(
      {
        success: true,
        message: 'Your fundraiser account has been created and is pending admin approval.',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Fundraiser registration error:', error)
    return NextResponse.json(
      { error: 'Unable to create account. Please try again.' },
      { status: 500 }
    )
  }
}
