import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function auditProductImages() {
  console.log('🔍 Auditing product images...\n')
  
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      featuredImage: true,
      images: true,
    },
    orderBy: { name: 'asc' }
  })
  
  const publicDir = path.join(process.cwd(), 'public')
  const issues: Array<{ product: string; issue: string }> = []
  const successes: string[] = []
  
  for (const product of products) {
    const productName = product.name
    
    // Check featuredImage
    if (!product.featuredImage) {
      issues.push({
        product: productName,
        issue: '❌ No featuredImage set'
      })
    } else {
      const imagePath = path.join(publicDir, product.featuredImage)
      if (!fs.existsSync(imagePath)) {
        issues.push({
          product: productName,
          issue: `❌ Featured image missing: ${product.featuredImage}`
        })
      } else {
        const stats = fs.statSync(imagePath)
        if (stats.size < 1024) {
          issues.push({
            product: productName,
            issue: `⚠️  Featured image too small (${stats.size} bytes): ${product.featuredImage}`
          })
        } else {
          successes.push(`✅ ${productName}`)
        }
      }
    }
    
    // Check additional images
    if (Array.isArray(product.images)) {
      for (const img of product.images) {
        const imagePath = path.join(publicDir, img)
        if (!fs.existsSync(imagePath)) {
          issues.push({
            product: productName,
            issue: `❌ Additional image missing: ${img}`
          })
        }
      }
    }
  }
  
  console.log('=== RESULTS ===\n')
  console.log(`Total products: ${products.length}`)
  console.log(`Products with valid images: ${successes.length}`)
  console.log(`Products with issues: ${issues.length}\n`)
  
  if (issues.length > 0) {
    console.log('=== ISSUES ===\n')
    for (const { product, issue } of issues) {
      console.log(`${product}:`)
      console.log(`  ${issue}\n`)
    }
  }
  
  if (successes.length > 0) {
    console.log('\n=== VALID PRODUCTS ===\n')
    for (const success of successes) {
      console.log(success)
    }
  }
  
  await prisma.$disconnect()
}

auditProductImages().catch(console.error)
