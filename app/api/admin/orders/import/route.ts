import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { parseOrderFile, importOrders } from '@/lib/orders/import'
import { createAuditLog } from '@/lib/audit'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const permitted = await hasPermission(session.user.id, 'orders:import')
    if (!permitted) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const createMissingProducts = formData.get('createMissingProducts') === 'true'
    const createMissingUsers = formData.get('createMissingUsers') === 'true'
    const skipDuplicates = formData.get('skipDuplicates') === 'true'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const { rows, errors: parseErrors } = await parseOrderFile(file, file.name)

    if (parseErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'File parsing errors',
          parseErrors,
        },
        { status: 400 }
      )
    }

    const result = await importOrders(rows, {
      createMissingProducts,
      createMissingUsers,
      skipDuplicates,
    })

    await createAuditLog({
      userId: session.user.id,
      action: 'orders.import',
      entityType: 'Order',
      changes: {
        totalRows: result.totalRows,
        successCount: result.successCount,
        errorCount: result.errorCount,
      },
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Order import error:', error)
    return NextResponse.json(
      { error: 'Failed to import orders', details: String(error) },
      { status: 500 }
    )
  }
}
