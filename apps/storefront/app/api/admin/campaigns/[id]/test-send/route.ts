import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import { sendEmail, substituteVariables } from '@/lib/email/sender'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:write'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { emails } = body
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Test email addresses required' }, { status: 400 })
    }
    if (emails.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 test addresses allowed' }, { status: 400 })
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: { template: true },
    })
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })

    const results: { email: string; success: boolean; error?: string }[] = []

    for (const email of emails) {
      const trimmedEmail = (email as string).trim().toLowerCase()
      const variables = {
        firstName: 'Test',
        lastName: 'User',
        email: trimmedEmail,
        previewMode: 'true',
      }
      const html = substituteVariables(campaign.template.html, variables)
      const subject = `[TEST] ${substituteVariables(campaign.subject, variables)}`

      const result = await sendEmail({ to: trimmedEmail, subject, html })
      results.push({ email: trimmedEmail, success: result.success, error: result.error })
    }

    return NextResponse.json({ success: true, results })
  } catch {
    return NextResponse.json({ error: 'Test send failed' }, { status: 500 })
  }
}
