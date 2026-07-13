import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import ExcelJS from 'exceljs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const permitted = await hasPermission(session.user as any, 'gift_certificates:read')
    if (!permitted) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'xlsx'
    const status = searchParams.get('status')

    const where: any = {}
    if (status && status !== 'ALL') {
      where.status = status
    }

    const giftCertificates = await prisma.giftCertificate.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
          },
        },
        usages: {
          select: {
            amount: true,
            createdAt: true,
            order: {
              select: {
                orderNumber: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (format === 'csv') {
      const Papa = (await import('papaparse')).default
      const data = giftCertificates.map(gc => ({
        Code: gc.code,
        'Original Amount': gc.originalAmount.toString(),
        'Current Balance': gc.balance.toString(),
        'Purchaser Name': gc.purchaserName,
        'Purchaser Email': gc.purchaserEmail,
        'Recipient Name': gc.recipientName,
        'Recipient Email': gc.recipientEmail || '',
        Theme: gc.theme,
        Status: gc.status,
        'Created At': new Date(gc.createdAt).toLocaleDateString(),
        'Expires At': gc.expiresAt ? new Date(gc.expiresAt).toLocaleDateString() : '',
        'Order Number': gc.order?.orderNumber || '',
        'Times Used': gc.usages.length,
      }))

      const csv = Papa.unparse(data)

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="gift-certificates-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Gift Certificates')

    worksheet.columns = [
      { header: 'Code', key: 'code', width: 20 },
      { header: 'Original Amount', key: 'originalAmount', width: 15 },
      { header: 'Current Balance', key: 'balance', width: 15 },
      { header: 'Purchaser Name', key: 'purchaserName', width: 20 },
      { header: 'Purchaser Email', key: 'purchaserEmail', width: 25 },
      { header: 'Recipient Name', key: 'recipientName', width: 20 },
      { header: 'Recipient Email', key: 'recipientEmail', width: 25 },
      { header: 'Theme', key: 'theme', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 15 },
      { header: 'Expires At', key: 'expiresAt', width: 15 },
      { header: 'Order Number', key: 'orderNumber', width: 20 },
      { header: 'Times Used', key: 'timesUsed', width: 12 },
    ]

    worksheet.getRow(1).font = { bold: true }

    giftCertificates.forEach(gc => {
      worksheet.addRow({
        code: gc.code,
        originalAmount: Number(gc.originalAmount),
        balance: Number(gc.balance),
        purchaserName: gc.purchaserName,
        purchaserEmail: gc.purchaserEmail,
        recipientName: gc.recipientName,
        recipientEmail: gc.recipientEmail || '',
        theme: gc.theme,
        status: gc.status,
        createdAt: new Date(gc.createdAt).toLocaleDateString(),
        expiresAt: gc.expiresAt ? new Date(gc.expiresAt).toLocaleDateString() : '',
        orderNumber: gc.order?.orderNumber || '',
        timesUsed: gc.usages.length,
      })
    })

    const buffer = await workbook.xlsx.writeBuffer()

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="gift-certificates-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Gift certificate export error:', error)
    return NextResponse.json(
      { error: 'Failed to export gift certificates', details: String(error) },
      { status: 500 }
    )
  }
}
