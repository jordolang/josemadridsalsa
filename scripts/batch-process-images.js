/**
 * Batch process product images to multiple formats
 * Converts images from the edited directory to JPG, PNG, and WebP formats
 */

const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')

async function batchProcess() {
  const inputDir = './photography/edited'
  const outputDir = './photography/exports'

  // Standard configuration for product images
  // 1200x1200px ensures adequate detail for zoom while keeping file sizes reasonable
  // White background for consistent product display on e-commerce sites
  const TARGET_SIZE = 1200
  const RESIZE_CONFIG = { 
    fit: 'contain', 
    background: '#ffffff' 
  }
  
  // Quality settings optimized for product photography
  const JPEG_QUALITY = 90 // High quality for product detail
  const PNG_COMPRESSION = 9 // Maximum compression for transparency
  const WEBP_QUALITY = 85 // Balanced quality/size ratio
  const WEBP_EFFORT = 6 // Higher effort for better compression

  try {
    // Verify input directory exists
    try {
      await fs.access(inputDir)
    } catch (error) {
      console.error(`❌ Input directory does not exist: ${inputDir}`)
      console.log('Please create it and add images to process.')
      return
    }

    // Create output directories if they don't exist
    await fs.mkdir(path.join(outputDir, 'jpg'), { recursive: true })
    await fs.mkdir(path.join(outputDir, 'png'), { recursive: true })
    await fs.mkdir(path.join(outputDir, 'webp'), { recursive: true })

    const files = await fs.readdir(inputDir)
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f))

    if (imageFiles.length === 0) {
      console.warn(`⚠️  No image files found in ${inputDir}`)
      console.log('Supported formats: .jpg, .jpeg, .png')
      return
    }

    console.log(`🔄 Processing ${imageFiles.length} images...\n`)

    for (const file of imageFiles) {
      const inputPath = path.join(inputDir, file)
      const name = path.parse(file).name

      try {
        // Process to JPG
        await sharp(inputPath)
          .resize(TARGET_SIZE, TARGET_SIZE, RESIZE_CONFIG)
          .jpeg({ quality: JPEG_QUALITY, progressive: true })
          .toFile(path.join(outputDir, 'jpg', `${name}.jpg`))

        // Process to PNG
        await sharp(inputPath)
          .resize(TARGET_SIZE, TARGET_SIZE, RESIZE_CONFIG)
          .png({ compressionLevel: PNG_COMPRESSION })
          .toFile(path.join(outputDir, 'png', `${name}.png`))

        // Process to WebP
        await sharp(inputPath)
          .resize(TARGET_SIZE, TARGET_SIZE, RESIZE_CONFIG)
          .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
          .toFile(path.join(outputDir, 'webp', `${name}.webp`))

        console.log(`✓ Processed: ${name}`)
      } catch (error) {
        console.error(`❌ Failed to process ${file}:`, error.message)
      }
    }

    console.log('\n✅ Batch processing complete!')
  } catch (error) {
    console.error('❌ Fatal error during batch processing:', error)
    process.exit(1)
  }
}

batchProcess().catch(console.error)
