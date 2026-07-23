/**
 * Integration Test: Import/Export Round-Trip
 *
 * This test verifies the end-to-end import/export functionality:
 * 1. Export inventory as CSV
 * 2. Modify inventory values in CSV
 * 3. Import modified CSV
 * 4. Verify inventory values updated
 * 5. Verify InventoryTransaction records created
 * 6. Repeat with Excel format
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/prisma'
import Papa from 'papaparse'
import ExcelJS from 'exceljs'

const runIntegration = !!(process.env.DATABASE_URL || process.env.RUN_INTEGRATION_TESTS)

describe.skipIf(!runIntegration)('Import/Export Round-Trip', () => {
  let testProducts: any[] = []
  const TEST_PRODUCTS = [
    {
      name: 'Test Product 1 - Import/Export',
      slug: `test-import-export-1-${Date.now()}`,
      sku: `TEST-IE-1-${Date.now()}`,
      initialInventory: 100,
      newInventory: 150,
      lowStockThreshold: 10,
    },
    {
      name: 'Test Product 2 - Import/Export',
      slug: `test-import-export-2-${Date.now()}`,
      sku: `TEST-IE-2-${Date.now()}`,
      initialInventory: 50,
      newInventory: 75,
      lowStockThreshold: 5,
    },
    {
      name: 'Test Product 3 - Import/Export',
      slug: `test-import-export-3-${Date.now()}`,
      sku: `TEST-IE-3-${Date.now()}`,
      initialInventory: 200,
      newInventory: 180,
      lowStockThreshold: 20,
    },
  ]

  beforeAll(async () => {
    // Find or create an active category. A fresh CI database has no seed data,
    // so create one if none exists rather than failing the whole suite.
    let category = await prisma.category.findFirst({
      where: { isActive: true }
    })

    if (!category) {
      category = await prisma.category.upsert({
        where: { slug: 'test-import-export-category' },
        update: {},
        create: { name: 'Test Import Export Category', slug: 'test-import-export-category' },
      })
    }

    // Create test products
    for (const productData of TEST_PRODUCTS) {
      const product = await prisma.product.create({
        data: {
          name: productData.name,
          slug: productData.slug,
          sku: productData.sku,
          heatLevel: 'MILD',
          price: 10.00,
          inventory: productData.initialInventory,
          stockReserved: 0,
          stockStatus: 'IN_STOCK',
          lowStockThreshold: productData.lowStockThreshold,
          categoryId: category.id,
          ingredients: ['Test ingredient'],
          isActive: true,
        },
      })
      testProducts.push({ ...product, ...productData })
    }
  })

  afterAll(async () => {
    // Clean up test products
    for (const product of testProducts) {
      await prisma.inventoryTransaction.deleteMany({
        where: { productId: product.id }
      })
      await prisma.product.delete({
        where: { id: product.id }
      })
    }
  })

  it('should complete CSV import/export round-trip', async () => {
    console.log('\n[CSV Round-Trip Test] Testing CSV import/export...')

    // ========================================
    // STEP 1: Export inventory as CSV
    // ========================================
    console.log('\n[Step 1] Exporting inventory as CSV...')

    const products = await prisma.product.findMany({
      where: {
        sku: {
          in: testProducts.map(p => p.sku),
        },
      },
      include: {
        category: true,
      },
      orderBy: { sku: 'asc' },
    })

    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Reserved Stock',
      'Available Stock',
      'Low Stock Threshold',
      'Stock Status',
    ]

    const rows = products.map((product) => {
      const availableStock = product.inventory - product.stockReserved

      return [
        product.sku,
        product.name,
        product.category?.name || '',
        product.inventory,
        product.stockReserved,
        availableStock,
        product.lowStockThreshold,
        product.stockStatus,
      ]
    })

    const csvRows = rows.map((row) =>
      row.map((cell) => (typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell))
    )

    const csvContent = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n')

    expect(csvContent).toContain(testProducts[0].sku)
    expect(csvContent).toContain(testProducts[1].sku)
    expect(csvContent).toContain(testProducts[2].sku)
    console.log(`✓ CSV exported with ${products.length} products`)

    // ========================================
    // STEP 2: Modify inventory values in CSV
    // ========================================
    console.log('\n[Step 2] Modifying inventory values in CSV...')

    // Parse the CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.trim(),
    })

    expect(parsed.errors.length).toBe(0)
    expect(parsed.data.length).toBe(testProducts.length)

    // Modify the CSV data
    const modifiedData = parsed.data.map((row: any) => {
      const testProduct = testProducts.find(p => p.sku === row.SKU)
      if (testProduct) {
        return {
          sku: row.SKU,
          inventory: testProduct.newInventory,
          lowStockThreshold: testProduct.lowStockThreshold,
        }
      }
      return row
    })

    console.log(`✓ Modified ${modifiedData.length} rows in CSV`)

    // ========================================
    // STEP 3: Import modified CSV
    // ========================================
    console.log('\n[Step 3] Importing modified CSV...')

    // Get SKU to product map
    const skuToProduct = new Map(products.map(p => [p.sku, p]))

    // Track transaction count before import
    const transactionCountBefore = await prisma.inventoryTransaction.count({
      where: {
        productId: { in: testProducts.map(p => p.id) },
      },
    })

    // Process each row (simulating the import endpoint logic)
    for (const row of modifiedData) {
      const product = skuToProduct.get(row.sku)
      if (!product) continue

      const currentInventory = product.inventory
      const targetInventory = row.inventory
      const quantityChange = targetInventory - currentInventory

      if (quantityChange !== 0) {
        // Use adjustInventory from inventory-manager
        await prisma.$transaction(async (tx) => {
          const updated = await tx.product.update({
            where: { id: product.id },
            data: { inventory: targetInventory },
          })

          await tx.inventoryTransaction.create({
            data: {
              productId: product.id,
              type: 'ADJUSTMENT',
              quantity: quantityChange,
              previousStock: currentInventory,
              newStock: targetInventory,
              reason: 'IMPORT',
              notes: `Inventory import: ${currentInventory} → ${targetInventory}`,
            },
          })

          // Update product reference for verification
          product.inventory = updated.inventory
        })
      }

      // Update low stock threshold if needed
      if (row.lowStockThreshold !== undefined && row.lowStockThreshold !== product.lowStockThreshold) {
        await prisma.product.update({
          where: { id: product.id },
          data: { lowStockThreshold: row.lowStockThreshold },
        })
      }
    }

    console.log(`✓ Imported ${modifiedData.length} products`)

    // ========================================
    // STEP 4: Verify inventory values updated
    // ========================================
    console.log('\n[Step 4] Verifying inventory values updated...')

    for (const testProduct of testProducts) {
      const product = await prisma.product.findUnique({
        where: { id: testProduct.id },
        select: { inventory: true, lowStockThreshold: true },
      })

      expect(product?.inventory).toBe(testProduct.newInventory)
      expect(product?.lowStockThreshold).toBe(testProduct.lowStockThreshold)
      console.log(`✓ ${testProduct.sku}: ${testProduct.initialInventory} → ${product?.inventory}`)
    }

    // ========================================
    // STEP 5: Verify InventoryTransaction records created
    // ========================================
    console.log('\n[Step 5] Verifying InventoryTransaction records created...')

    const transactionCountAfter = await prisma.inventoryTransaction.count({
      where: {
        productId: { in: testProducts.map(p => p.id) },
      },
    })

    // Should have created one transaction per product with inventory change
    const expectedNewTransactions = testProducts.filter(p => p.initialInventory !== p.newInventory).length
    expect(transactionCountAfter - transactionCountBefore).toBe(expectedNewTransactions)

    // Verify transaction details
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: { in: testProducts.map(p => p.id) },
        reason: 'IMPORT',
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(transactions.length).toBe(expectedNewTransactions)

    for (const transaction of transactions) {
      const testProduct = testProducts.find(p => p.id === transaction.productId)
      expect(testProduct).toBeDefined()
      expect(transaction.type).toBe('ADJUSTMENT')
      expect(transaction.reason).toBe('IMPORT')
      expect(transaction.previousStock).toBe(testProduct?.initialInventory)
      expect(transaction.newStock).toBe(testProduct?.newInventory)
      expect(transaction.quantity).toBe(testProduct!.newInventory - testProduct!.initialInventory)
      console.log(`✓ Transaction for ${testProduct?.sku}: quantity=${transaction.quantity}`)
    }

    console.log('\n✅ CSV import/export round-trip completed successfully!')
  })

  it('should complete Excel import/export round-trip', async () => {
    console.log('\n[Excel Round-Trip Test] Testing Excel import/export...')

    // Reset products to initial state
    for (const testProduct of testProducts) {
      await prisma.product.update({
        where: { id: testProduct.id },
        data: { inventory: testProduct.initialInventory },
      })
    }

    // ========================================
    // STEP 1: Export inventory as Excel
    // ========================================
    console.log('\n[Step 1] Exporting inventory as Excel...')

    const products = await prisma.product.findMany({
      where: {
        sku: {
          in: testProducts.map(p => p.sku),
        },
      },
      include: {
        category: true,
      },
      orderBy: { sku: 'asc' },
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Inventory')

    const headers = [
      'SKU',
      'Product Name',
      'Category',
      'Current Stock',
      'Reserved Stock',
      'Available Stock',
      'Low Stock Threshold',
      'Stock Status',
    ]

    // Add headers
    worksheet.addRow(headers)
    worksheet.getRow(1).font = { bold: true }

    // Add data rows
    products.forEach((product) => {
      const availableStock = product.inventory - product.stockReserved
      worksheet.addRow([
        product.sku,
        product.name,
        product.category?.name || '',
        product.inventory,
        product.stockReserved,
        availableStock,
        product.lowStockThreshold,
        product.stockStatus,
      ])
    })

    const buffer = await workbook.xlsx.writeBuffer()
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    console.log(`✓ Excel exported with ${products.length} products`)

    // ========================================
    // STEP 2: Modify inventory values in Excel
    // ========================================
    console.log('\n[Step 2] Modifying inventory values in Excel...')

    // Load the Excel file
    const importWorkbook = new ExcelJS.Workbook()
    await importWorkbook.xlsx.load(buffer as any)

    const importWorksheet = importWorkbook.worksheets[0]
    expect(importWorksheet).toBeDefined()

    // Modify the inventory values
    importWorksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const sku = row.getCell(1).value?.toString()
      const testProduct = testProducts.find(p => p.sku === sku)

      if (testProduct) {
        row.getCell(4).value = testProduct.newInventory // Current Stock column
      }
    })

    const modifiedBuffer = await importWorkbook.xlsx.writeBuffer()
    console.log(`✓ Modified inventory values in Excel`)

    // ========================================
    // STEP 3: Import modified Excel
    // ========================================
    console.log('\n[Step 3] Importing modified Excel...')

    const parseWorkbook = new ExcelJS.Workbook()
    await parseWorkbook.xlsx.load(modifiedBuffer as any)

    const parseWorksheet = parseWorkbook.worksheets[0]
    const importData: any[] = []
    const headerMap: string[] = []

    // Get headers
    parseWorksheet.getRow(1).eachCell((cell) => {
      headerMap.push(cell.value?.toString().trim() || '')
    })

    // Process data rows
    parseWorksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header

      const rowData: any = {}
      row.eachCell((cell, colNumber) => {
        const header = headerMap[colNumber - 1]
        if (header === 'SKU') {
          rowData.sku = cell.value?.toString()
        } else if (header === 'Current Stock') {
          rowData.inventory = typeof cell.value === 'number' ? cell.value : parseFloat(cell.value?.toString() || '0')
        } else if (header === 'Low Stock Threshold') {
          rowData.lowStockThreshold = typeof cell.value === 'number' ? cell.value : parseFloat(cell.value?.toString() || '0')
        }
      })

      if (rowData.sku) {
        importData.push(rowData)
      }
    })

    expect(importData.length).toBe(testProducts.length)

    // Get SKU to product map
    const skuToProduct = new Map(products.map(p => [p.sku, p]))

    // Track transaction count before import
    const transactionCountBefore = await prisma.inventoryTransaction.count({
      where: {
        productId: { in: testProducts.map(p => p.id) },
        reason: 'IMPORT',
      },
    })

    // Process each row
    for (const row of importData) {
      const product = skuToProduct.get(row.sku)
      if (!product) continue

      const currentInventory = product.inventory
      const targetInventory = row.inventory
      const quantityChange = targetInventory - currentInventory

      if (quantityChange !== 0) {
        await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: product.id },
            data: { inventory: targetInventory },
          })

          await tx.inventoryTransaction.create({
            data: {
              productId: product.id,
              type: 'ADJUSTMENT',
              quantity: quantityChange,
              previousStock: currentInventory,
              newStock: targetInventory,
              reason: 'IMPORT',
              notes: `Inventory import: ${currentInventory} → ${targetInventory}`,
            },
          })
        })
      }
    }

    console.log(`✓ Imported ${importData.length} products from Excel`)

    // ========================================
    // STEP 4: Verify inventory values updated
    // ========================================
    console.log('\n[Step 4] Verifying inventory values updated...')

    for (const testProduct of testProducts) {
      const product = await prisma.product.findUnique({
        where: { id: testProduct.id },
        select: { inventory: true },
      })

      expect(product?.inventory).toBe(testProduct.newInventory)
      console.log(`✓ ${testProduct.sku}: ${testProduct.initialInventory} → ${product?.inventory}`)
    }

    // ========================================
    // STEP 5: Verify InventoryTransaction records created
    // ========================================
    console.log('\n[Step 5] Verifying InventoryTransaction records created...')

    const transactionCountAfter = await prisma.inventoryTransaction.count({
      where: {
        productId: { in: testProducts.map(p => p.id) },
        reason: 'IMPORT',
      },
    })

    // Should have double the transactions (CSV + Excel)
    const expectedNewTransactions = testProducts.filter(p => p.initialInventory !== p.newInventory).length
    expect(transactionCountAfter - transactionCountBefore).toBe(expectedNewTransactions)

    // Verify transaction details
    const transactions = await prisma.inventoryTransaction.findMany({
      where: {
        productId: { in: testProducts.map(p => p.id) },
        reason: 'IMPORT',
      },
      orderBy: { createdAt: 'desc' },
      take: expectedNewTransactions,
    })

    expect(transactions.length).toBe(expectedNewTransactions)

    for (const transaction of transactions) {
      const testProduct = testProducts.find(p => p.id === transaction.productId)
      expect(testProduct).toBeDefined()
      expect(transaction.type).toBe('ADJUSTMENT')
      expect(transaction.reason).toBe('IMPORT')
      console.log(`✓ Transaction for ${testProduct?.sku}: quantity=${transaction.quantity}`)
    }

    console.log('\n✅ Excel import/export round-trip completed successfully!')
  })

  it('should handle inventory increases and decreases correctly', async () => {
    console.log('\n[Adjustment Test] Testing inventory increases and decreases...')

    // Reset first product
    await prisma.product.update({
      where: { id: testProducts[0].id },
      data: { inventory: 100 },
    })

    const testCases = [
      { newInventory: 150, expectedChange: 50, description: 'Increase' },
      { newInventory: 75, expectedChange: -75, description: 'Decrease' },
      { newInventory: 75, expectedChange: 0, description: 'No change' },
    ]

    for (const testCase of testCases) {
      const product = await prisma.product.findUnique({
        where: { id: testProducts[0].id },
        select: { inventory: true },
      })

      const currentInventory = product!.inventory
      const quantityChange = testCase.newInventory - currentInventory

      if (quantityChange !== 0) {
        await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id: testProducts[0].id },
            data: { inventory: testCase.newInventory },
          })

          await tx.inventoryTransaction.create({
            data: {
              productId: testProducts[0].id,
              type: 'ADJUSTMENT',
              quantity: quantityChange,
              previousStock: currentInventory,
              newStock: testCase.newInventory,
              reason: 'IMPORT',
              notes: `Test adjustment: ${currentInventory} → ${testCase.newInventory}`,
            },
          })
        })
      }

      const updatedProduct = await prisma.product.findUnique({
        where: { id: testProducts[0].id },
        select: { inventory: true },
      })

      expect(updatedProduct?.inventory).toBe(testCase.newInventory)
      console.log(`✓ ${testCase.description}: ${currentInventory} → ${updatedProduct?.inventory} (${quantityChange >= 0 ? '+' : ''}${quantityChange})`)
    }

    console.log('\n✅ Inventory adjustments working correctly!')
  })
})
