import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logEngagementRequest } from '@/lib/engagements'
import { sendFundraiserFollowupEmail } from '@/lib/email/automation'
import { sendEmail } from '@/lib/email/sender'

const FundraiserSignupSchema = z.object({
  contactName: z.string().min(2, 'Contact name is required'),
  organizationName: z.string().min(2, 'Organization name is required'),
  email: z.string().email(),
  phone: z.string().optional(),
  fundraisingGoal: z.string().optional(),
  message: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const payload = await request.json()
    const parsed = FundraiserSignupSchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid fundraiser signup data.' }, { status: 400 })
    }

    const data = parsed.data
    const normalizedEmail = data.email.trim().toLowerCase()

    await logEngagementRequest({
      type: 'FUNDRAISER',
      email: normalizedEmail,
      name: data.contactName,
      source: 'site:fundraising',
      metadata: {
        organization: data.organizationName,
        phone: data.phone,
        fundraisingGoal: data.fundraisingGoal,
        message: data.message,
      },
    })

    await sendFundraiserFollowupEmail({
      email: normalizedEmail,
      contactName: data.contactName,
      organizationName: data.organizationName,
      goal: data.fundraisingGoal ?? undefined,
    })

    const fundraisingInbox = process.env.FUNDRAISING_EMAIL || 'fundraising@josemadridsalsa.com'
    await sendEmail({
      to: fundraisingInbox,
      subject: `New Fundraiser Signup: ${data.organizationName}`,
      html: `<p><strong>Organization:</strong> ${data.organizationName}</p>
             <p><strong>Contact:</strong> ${data.contactName} (${normalizedEmail}${data.phone ? `, ${data.phone}` : ''})</p>
             <p><strong>Goal:</strong> ${data.fundraisingGoal || 'Not specified'}</p>
             <p><strong>Message:</strong></p>
             <p>${data.message ? data.message.replace(/\n/g, '<br/>') : '—'}</p>`,
      text: `Organization: ${data.organizationName}
Contact: ${data.contactName} (${normalizedEmail}${data.phone ? `, ${data.phone}` : ''})
Goal: ${data.fundraisingGoal || 'Not specified'}

Message:
${data.message || '—'}
`,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Fundraiser signup error:', error)
    return NextResponse.json(
      { error: 'Unable to submit your fundraiser details right now. Please try again soon.' },
      { status: 500 }
    )
  }
}
