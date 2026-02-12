/**
 * Optimize images to WebP format with quality comparison
 * Shows file size savings and conversion statistics
 */

import sharp from 'sharp'
import * as fs from 'fs/promises'
import * as path from 'path'

interface ConversionStats {
  file: string
  originalSize: number
  webpSize: number
  savings: number
}

async function optimizeToWebP(inputDir: string, quality: number = 85) {
  // Validate quality parameter
  if (quality < 0 || quality > 100) {
    throw new Error('Quality must be between 0 and 100')
  }

  const stats: ConversionStats[] = []

  try {
    // Verify input directory exists
    try {
      await fs.access(inputDir)
    } catch (error) {
      console.error(`❌ Input directory does not exist: ${inputDir}`)
      console.log('Please create the directory and add images to convert.')
      return
    }

    const files = await fs.readdir(inputDir)
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f))

    if (imageFiles.length === 0) {
      console.warn(`⚠️  No image files found in ${inputDir}`)
      console.log('Supported formats: .jpg, .jpeg, .png')
      return
    }

    console.log(`🔄 Converting ${imageFiles.length} images to WebP...\n`)

    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file)
      const name = path.parse(file).name
      const outputPath = path.join(inputDir, `${name}.webp`)

      try {
        // Get original size
        const originalStats = await fs.stat(inputPath)
        const originalSize = originalStats.size

        // Convert to WebP
        await sharp(inputPath)
          .webp({ quality, effort: 6 })
          .toFile(outputPath)

        // Get WebP size
        const webpStats = await fs.stat(outputPath)
        const webpSize = webpStats.size

        const savings = ((originalSize - webpSize) / originalSize * 100).toFixed(1)

        stats.push({
          file: name,
          originalSize,
          webpSize,
          savings: parseFloat(savings)
        })

        console.log(`✓ ${name}`)
        console.log(`  Original: ${(originalSize / 1024).toFixed(1)}KB`)
        console.log(`  WebP: ${(webpSize / 1024).toFixed(1)}KB`)
        console.log(`  Savings: ${savings}%\n`)
      } catch (error: any) {
        console.error(`❌ Failed to convert ${file}:`, error.message)
      }
    }

    // Summary
    if (stats.length > 0) {
      const totalOriginal = stats.reduce((sum, s) => sum + s.originalSize, 0)
      const totalWebP = stats.reduce((sum, s) => sum + s.webpSize, 0)
      const totalSavings = ((totalOriginal - totalWebP) / totalOriginal * 100).toFixed(1)

      console.log('=== SUMMARY ===')
      console.log(`Images converted: ${stats.length}`)
      console.log(`Total original size: ${(totalOriginal / 1024).toFixed(1)}KB`)
      console.log(`Total WebP size: ${(totalWebP / 1024).toFixed(1)}KB`)
      console.log(`Total savings: ${totalSavings}%`)
    }
  } catch (error) {
    console.error(`Failed to process directory: ${inputDir}`, error)
    throw error
  }
}

// Run with command line arguments or defaults
const args = process.argv.slice(2)
const inputDir = args[0] || path.join(process.cwd(), 'public', 'images', 'products')
const quality = args[1] ? parseInt(args[1]) : 85

console.log(`Input directory: ${inputDir}`)
console.log(`Quality: ${quality}\n`)

optimizeToWebP(inputDir, quality).catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
