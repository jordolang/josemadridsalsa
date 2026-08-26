import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, hasPermission } from '@/lib/rbac'
import Papa from 'papaparse'

/** A list built from the customer database exports tens of thousands of rows. */
export const maxDuration = 300

/**
 * Subscribers read per round trip.
 *
 * The export used to load every subscriber with every column and build one CSV
 * string in memory. Once a list reached tens of thousands of contacts that was
 * several megabytes held twice over — the rows and the string — inside a
 * serverless function, the same shape that broke the list page. Rows are now
 * read a page at a time and written straight into the response body, so
 * neither the list nor the CSV is ever fully resident.
 */
const BATCH_SIZE = 1000

const COLUMNS = [
  'Email',
  'First Name',
  'Last Name',
  'Phone',
  'Status',
  'Source',
  'Subscribed At',
  'Unsubscribed At',
  'Tags',
]

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
      select: { name: true },
    })

    if (!list) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const encoder = new TextEncoder()
    let cursorEmail: string | undefined

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Header up front, so an empty list still downloads a usable file.
        controller.enqueue(encoder.encode(Papa.unparse([COLUMNS])))
      },
      async pull(controller) {
        try {
          const batch = await prisma.mailingListSubscriber.findMany({
            where: { listId: id },
            // `(listId, email)` is unique, so email totally orders a single
            // list and the cursor rides the index the filter already uses.
            // `createdAt` cannot cursor: a CSV import stamps thousands of rows
            // with the same value, so rows would repeat or be skipped.
            orderBy: { email: 'asc' },
            take: BATCH_SIZE,
            ...(cursorEmail === undefined
              ? {}
              : {
                  cursor: { listId_email: { listId: id, email: cursorEmail } },
                  skip: 1,
                }),
            // `customFields` is deliberately absent: the importer parks every
            // unmapped column of the source CSV there, and no output column
            // reads it.
            select: {
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              status: true,
              source: true,
              createdAt: true,
              unsubscribedAt: true,
              tags: true,
            },
          })

          if (batch.length === 0) {
            controller.close()
            return
          }

          const rows = batch.map((sub) => ({
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

          controller.enqueue(
            encoder.encode(
              `\r\n${Papa.unparse(rows, { header: false, columns: COLUMNS })}`
            )
          )

          if (batch.length < BATCH_SIZE) {
            controller.close()
            return
          }
          cursorEmail = batch[batch.length - 1].email
        } catch (error) {
          // The status line is long gone by now, so a half-written file that
          // aborts is the only way left to signal the failure.
          console.error('CSV export error:', error)
          controller.error(error)
        }
      },
    })

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${list.name.replace(/[^a-z0-9]/gi, '_')}_subscribers.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
