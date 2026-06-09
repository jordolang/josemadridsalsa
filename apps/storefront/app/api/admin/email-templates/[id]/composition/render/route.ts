import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasAnyPermission } from '@/lib/rbac'
import { composeTemplate } from '@/lib/email/blocks'
import { z } from 'zod'

const renderSchema = z.object({
  variables: z.record(z.string(), z.any()).optional(),
})

// POST - Render a composition with variable substitution
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()

    if (!user || !(await hasAnyPermission(user, ['content:read']))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = renderSchema.parse(body)

    // Fetch the composition
    const composition = await prisma.emailTemplateComposition.findUnique({
      where: { templateId: id },
      include: {
        template: true,
      },
    })

    if (!composition) {
      return NextResponse.json(
        { error: 'Composition not found' },
        { status: 404 }
      )
    }

    // Render the composition
    const blocks = composition.blocks as any[]
    const variables = validatedData.variables || {}

    const html = composeTemplate(blocks, variables)

    return NextResponse.json({
      html,
      subject: composition.template.subject,
      plainText: composition.template.text,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid render data', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Error rendering composition:', error)
    return NextResponse.json(
      { error: 'Failed to render composition' },
      { status: 500 }
    )
  }
}
