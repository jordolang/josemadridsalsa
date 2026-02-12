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
          .resize(1200, 1200, { fit: 'contain', background: '#ffffff' })
          .jpeg({ quality: 90, progressive: true })
          .toFile(path.join(outputDir, 'jpg', `${name}.jpg`))

        // Process to PNG
        await sharp(inputPath)
          .resize(1200, 1200, { fit: 'contain', background: '#ffffff' })
          .png({ compressionLevel: 9 })
          .toFile(path.join(outputDir, 'png', `${name}.png`))

        // Process to WebP
        await sharp(inputPath)
          .resize(1200, 1200, { fit: 'contain', background: '#ffffff' })
          .webp({ quality: 85, effort: 6 })
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
