import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function fixProductImages() {
  console.log('🔧 Fixing product images...\n')
  
  const publicDir = path.join(process.cwd(), 'public')
  
  // Define the fixes needed
  const fixes = [
    {
      productName: 'Black Bean Corn Pablano',
      currentPath: '/images/products/black-bean-corn-poblano.webp',
      possibleFiles: [
        '/images/products/black-bean-corn-poblano-salsa.webp',
        '/images/products/black-bean-corn-poblano-salsa.png',
        '/images/products/black-bean-corn-poblano.jpg'
      ]
    },
    {
      productName: 'Jamaican Jerk',
      currentPath: '/images/products/jamaican-jerk.png',
      possibleFiles: [
        '/images/products/jamaican-jerk.webp',
        '/images/products/jamaican-jerk.jpg'
      ]
    },
    {
      productName: 'Strawberry Mild',
      currentPath: '/images/products/strawberry-mild.png',
      possibleFiles: [
        '/images/products/strawberry-mild.jpg',
        '/images/products/stawberry-mild.png'
      ]
    }
  ]
  
  for (const fix of fixes) {
    console.log(`\nChecking ${fix.productName}...`)
    
    // Find the first existing file
    let correctPath: string | null = null
    for (const possiblePath of fix.possibleFiles) {
      const fullPath = path.join(publicDir, possiblePath)
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        if (stats.size > 1024) { // At least 1KB
          correctPath = possiblePath
          console.log(`  ✅ Found valid image: ${possiblePath} (${(stats.size / 1024).toFixed(1)}KB)`)
          break
        }
      }
    }
    
    if (!correctPath) {
      console.log(`  ❌ No valid image found for ${fix.productName}`)
      continue
    }
    
    // Update the database
    try {
      const product = await prisma.product.findFirst({
        where: {
          name: {
            contains: fix.productName.split(' ')[0] // Match first word
          }
        }
      })
      
      if (!product) {
        console.log(`  ❌ Product not found in database: ${fix.productName}`)
        continue
      }
      
      await prisma.product.update({
        where: { id: product.id },
        data: {
          featuredImage: correctPath,
          images: [correctPath]
        }
      })
      
      console.log(`  ✅ Updated database: ${product.name}`)
      console.log(`     Old: ${fix.currentPath}`)
      console.log(`     New: ${correctPath}`)
    } catch (error) {
      console.error(`  ❌ Error updating ${fix.productName}:`, error)
    }
  }
  
  console.log('\n✨ Done!\n')
  await prisma.$disconnect()
}

fixProductImages().catch(console.error)
