import { z } from 'zod'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { OrderStatus, PaymentStatus } from '@prisma/client'

export const OrderImportRowSchema = z.object({
  orderNumber: z.string().optional(),
  customerEmail: z.string().email('Invalid email address'),
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().optional(),
  
  shippingFirstName: z.string().min(1, 'Shipping first name is required'),
  shippingLastName: z.string().min(1, 'Shipping last name is required'),
  shippingStreet: z.string().min(1, 'Shipping street is required'),
  shippingCity: z.string().min(1, 'Shipping city is required'),
  shippingState: z.string().min(2, 'Shipping state is required'),
  shippingZip: z.string().min(1, 'Shipping ZIP code is required'),
  shippingCountry: z.string().default('US'),
  shippingPhone: z.string().optional(),
  
  billingFirstName: z.string().optional(),
  billingLastName: z.string().optional(),
  billingStreet: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingZip: z.string().optional(),
  billingCountry: z.string().default('US'),
  
  productSku: z.string().min(1, 'Product SKU is required'),
  productName: z.string().min(1, 'Product name is required'),
  quantity: z.coerce.number().int().min(1, 'Quantity must be at least 1'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
  
  shippingCost: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  discountAmount: z.coerce.number().min(0).default(0),
  
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).default('PENDING'),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED']).default('PENDING'),
  paymentMethod: z.string().optional(),
  
  customerNotes: z.string().optional(),
  adminNotes: z.string().optional(),
  
  createdAt: z.string().optional(),
})

export type OrderImportRow = z.infer<typeof OrderImportRowSchema>

export interface OrderImportResult {
  success: boolean
  totalRows: number
  successCount: number
  errorCount: number
  errors: Array<{
    row: number
    field?: string
    message: string
    data?: any
  }>
  createdOrderIds: string[]
}

export async function parseOrderFile(
  file: File | Buffer,
  filename: string
): Promise<{ rows: any[]; errors: any[] }> {
  const ext = filename.toLowerCase().split('.').pop()

  if (ext === 'csv') {
    const content = file instanceof Buffer ? file.toString('utf-8') : await (file as File).text()
    return parseCSV(content)
  } else if (ext === 'xlsx' || ext === 'xls') {
    return parseExcel(file)
  } else {
    throw new Error('Unsupported file format. Please use CSV or XLSX files.')
  }
}

async function parseCSV(content: string): Promise<{ rows: any[]; errors: any[] }> {
  return new Promise((resolve) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        resolve({
          rows: results.data,
          errors: results.errors.map((err) => ({
            row: err.row,
            message: err.message,
          })),
        })
      },
    })
  })
}

async function parseExcel(file: File | Buffer): Promise<{ rows: any[]; errors: any[] }> {
  const workbook = new ExcelJS.Workbook()

  if (file instanceof Buffer) {
    await workbook.xlsx.load(file as any)
  } else {
    const buffer = await (file as File).arrayBuffer()
    await workbook.xlsx.load(Buffer.from(buffer) as any)
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('No worksheet found in Excel file')
  }

  const rows: any[] = []
  const headers: string[] = []
  
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(String(cell.value || '').trim())
      })
    } else {
      const rowData: any = {}
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1]
        if (header) {
          rowData[header] = cell.value
        }
      })
      if (Object.keys(rowData).length > 0) {
        rows.push(rowData)
      }
    }
  })

  return { rows, errors: [] }
}

export async function generateOrderNumber(): Promise<string> {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: {
        startsWith: `ORD-${year}${month}`,
      },
    },
    orderBy: { orderNumber: 'desc' },
  })

  let sequence = 1
  if (lastOrder) {
    const lastSequence = parseInt(lastOrder.orderNumber.split('-').pop() || '0')
    sequence = lastSequence + 1
  }

  return `ORD-${year}${month}-${String(sequence).padStart(5, '0')}`
}

export async function importOrders(
  rows: any[],
  options: {
    createMissingProducts?: boolean
    createMissingUsers?: boolean
    skipDuplicates?: boolean
  } = {}
): Promise<OrderImportResult> {
  const result: OrderImportResult = {
    success: false,
    totalRows: rows.length,
    successCount: 0,
    errorCount: 0,
    errors: [],
    createdOrderIds: [],
  }

  const orderGroups = new Map<string, any[]>()
  
  for (let i = 0; i < rows.length; i++) {
    try {
      const validated = OrderImportRowSchema.parse(rows[i])
      const groupKey = validated.orderNumber || `${validated.customerEmail}-${i}`

      if (!orderGroups.has(groupKey)) {
        orderGroups.set(groupKey, [])
      }
      orderGroups.get(groupKey)!.push({ ...validated, rowIndex: i })
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.issues.forEach((err: any) => {
          result.errors.push({
            row: i + 2,
            field: err.path.join('.'),
            message: err.message,
            data: rows[i],
          })
        })
      } else {
        result.errors.push({
          row: i + 2,
          message: String(error),
          data: rows[i],
        })
      }
      result.errorCount++
    }
  }

  for (const [groupKey, items] of orderGroups) {
    try {
      await createOrderFromItems(items, options)
      result.createdOrderIds.push(groupKey)
      result.successCount++
    } catch (error) {
      result.errors.push({
        row: items[0].rowIndex + 2,
        message: `Failed to create order: ${error}`,
        data: items,
      })
      result.errorCount++
    }
  }

  result.success = result.errorCount === 0
  return result
}

async function createOrderFromItems(
  items: Array<OrderImportRow & { rowIndex: number }>,
  options: {
    createMissingProducts?: boolean
    createMissingUsers?: boolean
    skipDuplicates?: boolean
  }
): Promise<void> {
  const firstItem = items[0]
  
  let user = null
  if (firstItem.customerEmail) {
    user = await prisma.user.findUnique({
      where: { email: firstItem.customerEmail },
    })

    if (!user && options.createMissingUsers) {
      user = await prisma.user.create({
        data: {
          email: firstItem.customerEmail,
          name: firstItem.customerName,
          role: 'CUSTOMER',
        },
      })
    }
  }

  const shippingAddress = user ? await prisma.address.create({
    data: {
      userId: user.id,
      type: 'SHIPPING',
      firstName: firstItem.shippingFirstName,
      lastName: firstItem.shippingLastName,
      street: firstItem.shippingStreet,
      city: firstItem.shippingCity,
      state: firstItem.shippingState,
      zipCode: firstItem.shippingZip,
      country: firstItem.shippingCountry,
      phone: firstItem.shippingPhone,
    },
  }) : await prisma.address.create({
    data: {
      userId: 'guest',
      type: 'SHIPPING',
      firstName: firstItem.shippingFirstName,
      lastName: firstItem.shippingLastName,
      street: firstItem.shippingStreet,
      city: firstItem.shippingCity,
      state: firstItem.shippingState,
      zipCode: firstItem.shippingZip,
      country: firstItem.shippingCountry,
      phone: firstItem.shippingPhone,
    },
  })

  let billingAddress = shippingAddress
  if (firstItem.billingStreet) {
    billingAddress = user ? await prisma.address.create({
      data: {
        userId: user.id,
        type: 'BILLING',
        firstName: firstItem.billingFirstName || firstItem.shippingFirstName,
        lastName: firstItem.billingLastName || firstItem.shippingLastName,
        street: firstItem.billingStreet,
        city: firstItem.billingCity || firstItem.shippingCity,
        state: firstItem.billingState || firstItem.shippingState,
        zipCode: firstItem.billingZip || firstItem.shippingZip,
        country: firstItem.billingCountry,
      },
    }) : await prisma.address.create({
      data: {
        userId: 'guest',
        type: 'BILLING',
        firstName: firstItem.billingFirstName || firstItem.shippingFirstName,
        lastName: firstItem.billingLastName || firstItem.shippingLastName,
        street: firstItem.billingStreet,
        city: firstItem.billingCity || firstItem.shippingCity,
        state: firstItem.billingState || firstItem.shippingState,
        zipCode: firstItem.billingZip || firstItem.shippingZip,
        country: firstItem.billingCountry,
      },
    })
  }

  let subtotal = 0
  const orderItems: any[] = []

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { sku: item.productSku },
    })

    if (!product && !options.createMissingProducts) {
      throw new Error(`Product with SKU ${item.productSku} not found`)
    }

    const productId = product?.id || 'placeholder'
    const itemTotal = item.unitPrice * item.quantity
    subtotal += itemTotal

    orderItems.push({
      productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: itemTotal,
      productName: item.productName,
      productSku: item.productSku,
    })
  }

  const total = subtotal + firstItem.shippingCost + firstItem.tax - firstItem.discountAmount

  const orderNumber = firstItem.orderNumber || (await generateOrderNumber())

  if (options.skipDuplicates) {
    const existing = await prisma.order.findUnique({
      where: { orderNumber },
    })
    if (existing) {
      return
    }
  }

  await prisma.order.create({
    data: {
      orderNumber,
      userId: user?.id,
      guestEmail: user ? undefined : firstItem.customerEmail,
      guestPhone: firstItem.customerPhone,
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id,
      status: firstItem.status as OrderStatus,
      paymentStatus: firstItem.paymentStatus as PaymentStatus,
      paymentMethod: firstItem.paymentMethod,
      subtotal,
      shippingCost: firstItem.shippingCost,
      tax: firstItem.tax,
      discountAmount: firstItem.discountAmount,
      total,
      customerNotes: firstItem.customerNotes,
      adminNotes: firstItem.adminNotes,
      createdAt: firstItem.createdAt ? new Date(firstItem.createdAt) : undefined,
      items: {
        create: orderItems,
      },
    },
  })
}
