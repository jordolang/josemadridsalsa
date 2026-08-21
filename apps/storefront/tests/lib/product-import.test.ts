import { describe, it, expect } from 'vitest'
import { parseCSV, validateProducts } from '@/lib/product-import'

describe('Product Import - CSV Parsing', () => {
  describe('parseCSV', () => {
    it('should parse CSV with comment lines starting with #', async () => {
      const csvWithComments = `# This is a comment line
# Another comment line
name,slug,sku,price,heatLevel,categoryName
Test Product,test-product,TEST-001,9.99,MILD,Hot Sauces
Another Product,another-product,TEST-002,12.99,MEDIUM,Salsas`

      const buffer = Buffer.from(csvWithComments, 'utf-8')
      const result = await parseCSV(buffer)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.length).toBe(2)
      expect(result.data?.[0].name).toBe('Test Product')
      expect(result.data?.[1].name).toBe('Another Product')
    })

    it('should parse CSV without comment lines', async () => {
      const csvWithoutComments = `name,slug,sku,price,heatLevel,categoryName
Test Product,test-product,TEST-001,9.99,MILD,Hot Sauces`

      const buffer = Buffer.from(csvWithoutComments, 'utf-8')
      const result = await parseCSV(buffer)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.length).toBe(1)
      expect(result.data?.[0].name).toBe('Test Product')
    })

    it('should skip empty lines', async () => {
      const csvWithEmptyLines = `name,slug,sku,price,heatLevel,categoryName

Test Product,test-product,TEST-001,9.99,MILD,Hot Sauces

Another Product,another-product,TEST-002,12.99,MEDIUM,Salsas

`

      const buffer = Buffer.from(csvWithEmptyLines, 'utf-8')
      const result = await parseCSV(buffer)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.length).toBe(2)
    })

    it('should handle quoted fields with commas', async () => {
      const csvWithQuotes = `name,slug,sku,description,price,heatLevel,categoryName
"Hot Sauce, Extra Spicy",hot-sauce-spicy,TEST-001,"Contains jalapeños, habaneros, and more",9.99,HOT,Hot Sauces`

      const buffer = Buffer.from(csvWithQuotes, 'utf-8')
      const result = await parseCSV(buffer)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.length).toBe(1)
      expect(result.data?.[0].name).toBe('Hot Sauce, Extra Spicy')
      expect(result.data?.[0].description).toBe('Contains jalapeños, habaneros, and more')
    })

    it('should trim header names', async () => {
      const csvWithSpaces = `  name  ,  slug  ,  sku  ,  price  ,  heatLevel  ,  categoryName  
Test Product,test-product,TEST-001,9.99,MILD,Hot Sauces`

      const buffer = Buffer.from(csvWithSpaces, 'utf-8')
      const result = await parseCSV(buffer)

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.[0]).toHaveProperty('name')
      expect(result.data?.[0]).toHaveProperty('slug')
      expect(result.data?.[0].name).toBe('Test Product')
    })
  })
})

describe('Product Import - ingredient statements', () => {
  const row = (ingredients: string) => ({
    name: 'Original Mild',
    slug: 'original-mild',
    sku: 'JMS-MILD-001',
    price: '7.99',
    heatLevel: 'MILD',
    categoryId: 'cat-1',
    ingredients,
  })
  const categories = new Map([['mild salsa', 'cat-1']])

  it('keeps sub-ingredients attached to the ingredient they belong to', () => {
    const result = validateProducts(
      [row('Diced Tomatoes (Tomatoes, Citric Acid), Water and Spices.')],
      categories
    )

    expect(result.validationErrors ?? []).toEqual([])
    expect(result.data?.[0].ingredients).toEqual([
      'Diced Tomatoes (Tomatoes, Citric Acid)',
      'Water',
      'Spices',
    ])
  })

  it('rejects a statement whose sub-ingredient group never closes', () => {
    // Importing it would persist the wrong grouping and publish it from there.
    const result = validateProducts([row('Diced Tomatoes (Tomatoes, Citric Acid, Water')], categories)

    expect(result.data ?? []).toEqual([])
    expect(result.validationErrors?.[0].errors.join(' ')).toContain('ingredients')
  })
})
