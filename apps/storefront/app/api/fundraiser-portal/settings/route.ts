import { NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireFundraiserAccess, getCurrentFundraiserAccount } from '@/lib/rbac'

export async function GET() {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const { fundraiser } = account

    return NextResponse.json({
      subdomain: fundraiser.subdomain,
      contactEmail: fundraiser.contactEmail,
      contactPhone: fundraiser.contactPhone,
      bio: fundraiser.bio,
      missionStatement: fundraiser.missionStatement,
      thankYouHeadline: fundraiser.thankYouHeadline,
      thankYouMessage: fundraiser.thankYouMessage,
      thankYouImageUrl: fundraiser.thankYouImageUrl,
      thankYouCtaLabel: fundraiser.thankYouCtaLabel,
      thankYouCtaUrl: fundraiser.thankYouCtaUrl,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}

const UpdateSettingsSchema = z.object({
  subdomain: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'Only lowercase letters, numbers, and hyphens').optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  bio: z.string().max(5000).optional(),
  missionStatement: z.string().max(2000).optional(),
  // The campaign's own thank-you page. Every field is optional and a blank one falls back to
  // copy built from the organization's name — see `lib/fundraising/thank-you.ts`.
  thankYouHeadline: z.string().max(120).nullable().optional(),
  thankYouMessage: z.string().max(2000).nullable().optional(),
  thankYouImageUrl: z.string().url().nullable().optional().or(z.literal('')),
  thankYouCtaLabel: z.string().max(60).nullable().optional(),
  thankYouCtaUrl: z.string().url().nullable().optional().or(z.literal('')),
})

export async function PATCH(request: Request) {
  try {
    await requireFundraiserAccess()
    const account = await getCurrentFundraiserAccount()
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const body = await request.json()
    const parsed = UpdateSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Check subdomain uniqueness if it changed
    if (parsed.data.subdomain && parsed.data.subdomain !== account.fundraiser.subdomain) {
      const existing = await prisma.fundraiser.findUnique({
        where: { subdomain: parsed.data.subdomain },
        select: { id: true },
      })
      if (existing && existing.id !== account.fundraiserId) {
        return NextResponse.json(
          { error: 'This subdomain is already taken.', field: 'subdomain' },
          { status: 409 }
        )
      }
    }

    const data: Record<string, unknown> = {}
    if (parsed.data.subdomain !== undefined) data.subdomain = parsed.data.subdomain
    if (parsed.data.contactEmail !== undefined) data.contactEmail = parsed.data.contactEmail
    if (parsed.data.contactPhone !== undefined) data.contactPhone = parsed.data.contactPhone
    if (parsed.data.bio !== undefined) data.bio = parsed.data.bio
    if (parsed.data.missionStatement !== undefined) data.missionStatement = parsed.data.missionStatement
    for (const field of [
      'thankYouHeadline',
      'thankYouMessage',
      'thankYouImageUrl',
      'thankYouCtaLabel',
      'thankYouCtaUrl',
    ] as const) {
      // An emptied field means "go back to the standard wording", which is what null stores.
      if (parsed.data[field] !== undefined) data[field] = parsed.data[field] || null
    }

    if (Object.keys(data).length > 0) {
      await prisma.fundraiser.update({
        where: { id: account.fundraiserId },
        data,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    const status = message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
