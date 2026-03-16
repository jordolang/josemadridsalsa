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
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50)
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

    // Generate a unique subdomain from the org name
    let subdomain = generateSubdomain(organizationName)
    const existingSubdomain = await prisma.fundraiser.findUnique({
      where: { subdomain },
      select: { id: true },
    })
    if (existingSubdomain) {
      subdomain = `${subdomain}-${Date.now().toString(36).slice(-4)}`
    }

    // Generate a unique slug
    let slug = subdomain
    const existingSlug = await prisma.fundraiser.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`
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
          commissionRate: 40,
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
