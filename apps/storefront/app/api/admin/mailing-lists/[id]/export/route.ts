import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import Papa from 'papaparse'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const user = await getCurrentUser()
    if (!user || !(await hasPermission(user, 'content:read'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const list = await prisma.mailingList.findUnique({
      where: { id },
      include: {
        subscribers: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!list) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const rows = list.subscribers.map((sub) => ({
      Email: sub.email,
      'First Name': sub.firstName || '',
      'Last Name': sub.lastName || '',
      Phone: sub.phone || '',
      Status: sub.status,
      Source: sub.source || '',
      'Subscribed At': sub.createdAt.toISOString(),
      'Unsubscribed At': sub.unsubscribedAt?.toISOString() || '',
      Tags: sub.tags.join(', '),
    }))

    const csv = Papa.unparse(rows)

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}_subscribers.csv"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
