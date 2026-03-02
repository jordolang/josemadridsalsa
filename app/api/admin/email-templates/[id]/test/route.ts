import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { sendEmail, substituteVariables } from '@/lib/email/sender'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:write']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, variables = {} } = body

    if (!email) {
      return NextResponse.json(
        { success: false, message: 'Email address is required' },
        { status: 400 }
      )
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, message: 'Template not found' },
        { status: 404 }
      )
    }

    // Substitute variables
    const subject = substituteVariables(template.subject, variables)
    const html = substituteVariables(template.html, variables)
    const text = template.text ? substituteVariables(template.text, variables) : undefined

    // Send test email
    const result = await sendEmail({
      to: email,
      subject: `[TEST] ${subject}`,
      html,
      text,
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Failed to send test email',
      })
    }
  } catch (error) {
    console.error('Error sending test email:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to send test email',
      },
      { status: 500 }
    )
  }
}
