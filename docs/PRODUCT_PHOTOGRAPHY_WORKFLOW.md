# Product Photography Workflow

This document outlines the complete workflow for capturing, processing, and optimizing product images for the Jose Madrid Salsa e-commerce application.

## Photography Standards

### Equipment Requirements

**Minimum Setup:**
- Camera: DSLR, mirrorless, or high-quality smartphone (12MP+)
- Lighting: 2-3 softbox lights or natural diffused light
- Background: White seamless paper or foam board
- Tripod: Stable mount for consistent framing
- Props: Neutral bowls, chips, or serving dishes (optional)

**Professional Setup:**
- Camera: Full-frame DSLR (Canon 5D, Nikon D850, Sony A7)
- Lens: 50mm f/1.8 or 100mm macro
- Lighting: 3-point lighting setup with softboxes
- Light meter: For consistent exposure
- Color checker: X-Rite ColorChecker for accurate color

### Camera Settings

**Recommended Settings:**
```
Mode: Manual (M)
ISO: 100-200 (minimize noise)
Aperture: f/8-f/11 (sharp focus throughout)
Shutter Speed: 1/125s or faster
White Balance: Custom or 5500K (daylight)
Format: RAW + JPEG
Color Space: sRGB (for web)
```

**Focus:**
- Use manual focus or single-point AF
- Focus on the product label or front face
- Focus stacking for increased depth of field (optional)

### Composition Guidelines

**Standard Product Shot:**
- Product centered in frame
- Fill 60-70% of frame
- Straight-on angle (eye-level to product)
- Label facing camera, fully readable
- Consistent positioning across all products

**Framing:**
```
Dimensions: 1200x1200px minimum (square format)
Aspect Ratio: 1:1 (square)
Resolution: 72-150 DPI for web
Safe Zone: 10% margin around product
```

**Lighting Setup:**
- Key light: 45° angle, slightly above product
- Fill light: Opposite side, lower intensity
- Back light: Behind product, rim lighting (optional)
- No harsh shadows on background
- Even, diffused illumination

### Product Staging

**Salsa Jars:**
1. Clean jar thoroughly (remove dust, fingerprints)
2. Ensure label is straight and undamaged
3. Remove any price stickers or tags
4. Position cap/lid consistently (facing forward)
5. Check for air bubbles in product

**Multi-Pack Sets:**
1. Arrange jars in visually pleasing composition
2. Stagger heights if multiple rows
3. Ensure all labels are visible
4. Use consistent spacing between jars
5. Include gift box if applicable

**Props (Optional):**
- Use neutral white or wooden bowls
- Include tortilla chips (natural color)
- Add fresh ingredients (tomatoes, peppers, cilantro)
- Keep props minimal and not distracting
- Maintain brand consistency

## AI-Assisted Photography Prompts

### Using AI for Image Enhancement

**When to Use AI:**
- Background removal/cleanup
- Shadow enhancement
- Color correction
- Minor blemish removal
- Consistency adjustments

**When NOT to Use AI:**
- Generating fake product photos
- Altering product appearance significantly
- Misrepresenting product color or size
- Creating entirely synthetic images

### AI Prompt Templates

**Background Removal (Photoshop AI, Remove.bg):**
```
Remove background completely, keep only the salsa jar.
Preserve jar transparency and reflections.
Output PNG with alpha channel.
```

**Color Enhancement (Adobe Sensei, Luminar):**
```
Enhance vibrant salsa colors naturally.
Maintain realistic product appearance.
Boost label readability and contrast.
Preserve natural jar reflections.
Match color temperature to other product photos.
```

**Shadow Generation (AI Shadow Generator):**
```
Add subtle product shadow beneath jar.
Shadow direction: bottom center, slight right.
Shadow opacity: 30-40%.
Shadow blur: 15-20px radius.
Natural, not harsh.
```

**Image Upscaling (Topaz Gigapixel, AI Image Enlarger):**
```
Upscale to 2400x2400px.
Preserve sharp edges on label text.
Maintain jar transparency and highlights.
Enhance details without artifacts.
Output format: PNG, highest quality.
```

**Batch Consistency (ChatGPT/Claude Prompt):**
```
"Analyze these 5 product photos and identify inconsistencies in:
- Background color/tone
- Lighting direction and intensity
- Product positioning and size
- Color temperature
- Shadow placement

Provide specific adjustment recommendations for each image to achieve consistency."
```

### AI Tool Recommendations

**Background Removal:**
- Remove.bg (quick, automated)
- Adobe Photoshop (Remove Background tool)
- Photoshop Express (mobile)

**Enhancement:**
- Adobe Lightroom AI
- Luminar AI
- Pixelmator Pro (Mac)

**Upscaling:**
- Topaz Gigapixel AI
- Let's Enhance
- Upscayl (free, open-source)

**Batch Processing:**
- Adobe Bridge + Photoshop Actions
- Lightroom Presets
- ImageMagick (command-line)

### Security Best Practices for API-Based Tools

**⚠️ Important Security Considerations:**

When using API-based services like Remove.bg or other third-party tools:

1. **API Key Management:**
   - Never commit API keys to source code or version control
   - Store keys in environment variables (`.env.local` file)
   - Use different keys for development and production
   - Rotate keys periodically

2. **Cost Management:**
   - Be aware that many services are paid (Remove.bg charges per image)
   - Set up usage alerts and billing limits
   - Test with small batches before processing hundreds of images
   - Consider rate limiting for batch operations

3. **Data Privacy:**
   - Review the service's data retention policy
   - Understand where your images are processed and stored
   - Use secure HTTPS connections
   - Consider self-hosted alternatives for sensitive images

4. **Example Environment Variable Setup:**
   ```bash
   # .env.local (NEVER commit this file)
   REMOVEBG_API_KEY=your_api_key_here
   OPENAI_API_KEY=your_api_key_here
   ```

   Usage in scripts:
   ```javascript
   const apiKey = process.env.REMOVEBG_API_KEY
   if (!apiKey) {
     throw new Error('REMOVEBG_API_KEY not configured')
   }
   ```

## Batch Processing Workflow

### Directory Structure for Processing

```
photography/
├── raw/                    # Original RAW + JPEG from camera
│   ├── session-2024-01-15/
│   └── session-2024-01-22/
├── edited/                 # Post-processed images
│   ├── 01-original-mild.psd
│   └── 02-cherry-hot.psd
├── exports/                # Final exports
│   ├── jpg/               # High-quality JPG
│   ├── png/               # PNG with transparency
│   └── webp/              # Optimized WebP
└── archive/               # Backups
```

### Step-by-Step Batch Processing

**Phase 1: Import and Sort**
```bash
# Create session directory
mkdir -p photography/raw/session-$(date +%Y-%m-%d)

# Import photos from camera/card
# macOS example (using rsync for safer handling of spaces/special characters)
rsync -av /Volumes/SD_CARD/DCIM/ photography/raw/session-$(date +%Y-%m-%d)/
# Linux example
# rsync -av /media/$USER/SD_CARD/ photography/raw/session-$(date +%Y-%m-%d)/
# Or use cp with quoted paths
# CAMERA_PATH="/Volumes/SD Card/DCIM"
# cp -R "$CAMERA_PATH"/* photography/raw/session-$(date +%Y-%m-%d)/

# Sort and rename
cd photography/raw/session-$(date +%Y-%m-%d)
# Manually review and rename files to match product names
```

**Phase 2: Batch Edit in Lightroom**

1. **Import to Lightroom**
   - Create collection: "Jose Madrid - Session [Date]"
   - Import RAW files
   - Apply metadata: Copyright, keywords

2. **Create Base Preset**
   ```
   Preset Name: Jose_Madrid_Base

   Settings:
   - White Balance: 5500K
   - Exposure: +0.3 to +0.5
   - Contrast: +10
   - Highlights: -10
   - Shadows: +15
   - Whites: +5
   - Blacks: -5
   - Clarity: +15
   - Vibrance: +20
   - Saturation: +5
   ```

3. **Apply to All Images**
   - Select all images
   - Apply preset
   - Individually adjust as needed

4. **Export Settings**
   ```
   Format: JPEG
   Quality: 90
   Color Space: sRGB
   Resize: Long Edge 1200px
   Sharpening: Standard, Screen
   Metadata: Copyright only
   ```

**Phase 3: Background Removal (Batch)**

Using **Photoshop Actions:**
```javascript
// Photoshop Action: "Remove Background - Salsa Jar"
// Record these steps:

1. Open image
2. Select > Subject (AI selection)
3. Select > Inverse
4. Delete background
5. Layer > Matting > Defringe (1px)
6. File > Export > Quick Export as PNG
7. Close without saving
```

**Batch via Photoshop:**
```
File > Automate > Batch
- Choose Action: "Remove Background - Salsa Jar"
- Source: Folder (select edited/jpg)
- Destination: Folder (select exports/png)
- Override "Save As" commands
```

**Phase 4: WebP Conversion**

See [WebP Optimization](#webp-optimization) section below.

### Command-Line Batch Processing

**Using ImageMagick:**

```bash
#!/bin/bash
# Batch process salsa images

INPUT_DIR="photography/edited"
OUTPUT_JPG="photography/exports/jpg"
OUTPUT_PNG="photography/exports/png"

# Create output directories
mkdir -p "$OUTPUT_JPG" "$OUTPUT_PNG"

# Process all images
for img in "$INPUT_DIR"/*.jpg; do
  filename=$(basename "$img" .jpg)

  # Resize and optimize JPG
  convert "$img" \
    -resize 1200x1200 \
    -quality 90 \
    -strip \
    "$OUTPUT_JPG/$filename.jpg"

  # Create PNG with white background
  convert "$img" \
    -resize 1200x1200 \
    -background white \
    -alpha remove \
    -strip \
    "$OUTPUT_PNG/$filename.png"

  echo "Processed: $filename"
done

echo "Batch processing complete!"
```

**Using Sharp (Node.js):**

```javascript
// scripts/batch-process-images.js
const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')

async function batchProcess() {
  const inputDir = './photography/edited'
  const outputDir = './photography/exports'

  const files = await fs.readdir(inputDir)
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f))

  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file)
    const name = path.parse(file).name

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
  }

  console.log('\n✅ Batch processing complete!')
}

batchProcess().catch(console.error)
```

**Run the script:**
```bash
npm install sharp
node scripts/batch-process-images.js
```

## WebP Optimization

### Why WebP?

**Benefits:**
- 25-35% smaller file size than JPEG (same quality)
- Supports transparency (like PNG)
- Supported by all modern browsers
- Better compression algorithms
- Progressive loading support

**When to Use WebP:**
- All product photography (primary format)
- Hero images
- Gallery images
- Marketing materials

**Fallback Strategy:**
- Keep JPEG/PNG for older browsers
- Use `<picture>` element for automatic fallback

### WebP Conversion Tools

**Command-Line (cwebp):**

Install:
```bash
# macOS
brew install webp

# Ubuntu/Debian
sudo apt-get install webp

# Windows
# Download from: https://developers.google.com/speed/webp/download
```

**Basic Conversion:**
```bash
cwebp input.jpg -q 85 -o output.webp
```

**Advanced Options:**
```bash
cwebp input.jpg \
  -q 85 \              # Quality (0-100)
  -m 6 \               # Compression method (0-6, higher=slower/better)
  -af \                # Auto-filter
  -progress \          # Show progress
  -mt \                # Multi-threading
  -o output.webp
```

**Batch Conversion:**
```bash
#!/bin/bash
# Convert all JPG to WebP

for img in ./public/images/products/*.jpg; do
  filename=$(basename "$img" .jpg)
  cwebp -q 85 -m 6 -af "$img" -o "./public/images/products/${filename}.webp"
  echo "Converted: $filename.webp"
done
```

### WebP Optimization Script

**Create: `scripts/optimize-to-webp.ts`**

```typescript
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
    const files = await fs.readdir(inputDir)
    const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f))

    if (imageFiles.length === 0) {
      console.warn(`No image files found in ${inputDir}`)
      return
    }

    console.log(`🔄 Converting ${imageFiles.length} images to WebP...\n`)

  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file)
    const name = path.parse(file).name
    const outputPath = path.join(inputDir, `${name}.webp`)

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
  }

  // Summary
  const totalOriginal = stats.reduce((sum, s) => sum + s.originalSize, 0)
  const totalWebP = stats.reduce((sum, s) => sum + s.webpSize, 0)
  const totalSavings = ((totalOriginal - totalWebP) / totalOriginal * 100).toFixed(1)

  console.log('=== SUMMARY ===')
  console.log(`Images converted: ${stats.length}`)
  console.log(`Total original size: ${(totalOriginal / 1024).toFixed(1)}KB`)
  console.log(`Total WebP size: ${(totalWebP / 1024).toFixed(1)}KB`)
  console.log(`Total savings: ${totalSavings}%`)
  } catch (error) {
    console.error(`Failed to process directory: ${inputDir}`, error)
    throw error
  }
}

// Run
const inputDir = path.join(process.cwd(), 'public', 'images', 'products')
optimizeToWebP(inputDir, 85).catch(console.error)
```

**Usage:**
```bash
npm install sharp
npx ts-node scripts/optimize-to-webp.ts
```

### Implementing WebP in Next.js

**Automatic WebP Support:**

Next.js `<Image>` component automatically serves WebP when supported:

```tsx
import Image from 'next/image'

<Image
  src="/images/products/original-mild-1.jpg"
  alt="Original Mild Salsa"
  width={400}
  height={400}
  quality={85}
  // Next.js automatically serves WebP when available
/>
```

**Manual WebP with Fallback:**

```tsx
<picture>
  <source
    srcSet="/images/products/original-mild-1.webp"
    type="image/webp"
  />
  <source
    srcSet="/images/products/original-mild-1.jpg"
    type="image/jpeg"
  />
  <img
    src="/images/products/original-mild-1.jpg"
    alt="Original Mild Salsa"
    width={400}
    height={400}
  />
</picture>
```

**Responsive WebP:**

```tsx
<picture>
  <source
    media="(min-width: 768px)"
    srcSet="/images/products/original-mild-1.webp"
    type="image/webp"
  />
  <source
    media="(min-width: 768px)"
    srcSet="/images/products/original-mild-1.jpg"
    type="image/jpeg"
  />
  <source
    srcSet="/images/products/original-mild-1-small.webp"
    type="image/webp"
  />
  <img
    src="/images/products/original-mild-1-small.jpg"
    alt="Original Mild Salsa"
    loading="lazy"
  />
</picture>
```

### WebP Quality Guidelines

**Quality Settings by Use Case:**

```
Product Thumbnails (grid view):
- Quality: 75-80
- Size: 400x400px
- File size target: 15-25KB

Product Detail Images:
- Quality: 85-90
- Size: 800x800px
- File size target: 40-70KB

Hero Images:
- Quality: 90-95
- Size: 1920x1080px
- File size target: 100-150KB

High-Quality Gallery:
- Quality: 95
- Size: 2400x2400px
- File size target: 200-300KB
```

**Testing Quality:**

```bash
# Convert at different quality levels for comparison
cwebp input.jpg -q 75 -o output-75.webp
cwebp input.jpg -q 85 -o output-85.webp
cwebp input.jpg -q 95 -o output-95.webp

# Check file sizes
ls -lh output-*.webp
```

**How to Choose Quality Level:**

1. Start at q85 (recommended baseline)
2. If file size > target: try q80
3. If quality loss visible: try q90
4. Check label text readability at each level
5. Test on actual devices (mobile/desktop)
6. Verify color accuracy for product representation

## Quality Control Checklist

### Pre-Photography
- [ ] Equipment clean and charged
- [ ] Lighting setup tested and consistent
- [ ] Background clean and wrinkle-free
- [ ] Products cleaned and labels straight
- [ ] Camera settings configured correctly
- [ ] Test shot reviewed for exposure and focus

### During Photography
- [ ] Each product photographed from same angle
- [ ] Consistent positioning and framing
- [ ] Labels clearly readable
- [ ] No shadows on background
- [ ] Multiple shots per product (backup)
- [ ] Periodically review on larger screen

### Post-Processing
- [ ] Colors accurate and consistent across products
- [ ] Background pure white (#FFFFFF)
- [ ] No visible artifacts or compression issues
- [ ] Labels sharp and readable
- [ ] Proper file naming convention followed
- [ ] Correct dimensions (1200x1200px minimum)

### WebP Conversion
- [ ] Quality setting appropriate (85 recommended)
- [ ] File size acceptable (<100KB for 1200x1200)
- [ ] No visible quality loss
- [ ] Transparency preserved (if applicable)
- [ ] Fallback images available (JPG/PNG)

### Pre-Deployment
- [ ] All images in correct directory
- [ ] File names match database references
- [ ] Images load correctly in browser
- [ ] No 404 errors in console
- [ ] Mobile display tested
- [ ] WebP serving correctly with fallback
- [ ] Run audit script: `npx ts-node scripts/audit-product-images.ts`

## Troubleshooting

### Common Issues

**Issue: Inconsistent Colors Across Images**

**Cause:** Different camera settings, lighting, or white balance

**Solution:**
```bash
# Batch adjust white balance in Lightroom
1. Select all images
2. Match white balance to reference image
3. Sync settings across all images

# Or use ImageMagick for quick fix:
convert input.jpg -auto-level -o output.jpg
```

**Issue: WebP Files Too Large**

**Cause:** Quality setting too high or image too complex

**Solution:**
```bash
# Try lower quality (usually 80-85 is fine)
cwebp -q 80 input.jpg -o output.webp

# Use more aggressive compression
cwebp -q 85 -m 6 -af input.jpg -o output.webp

# Check if source image is already compressed
identify -verbose input.jpg | grep Quality
```

**Issue: WebP Not Loading in Browser**

**Cause:** Browser doesn't support WebP or path incorrect

**Solution:**
```tsx
// Implement proper fallback
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Product" />
</picture>

// Or use Next.js Image component (handles automatically)
<Image src="/images/product.jpg" ... />
```

**Issue: Background Not Pure White**

**Cause:** Uneven lighting or camera settings

**Solution:**
```bash
# Force white background in ImageMagick
convert input.jpg -background white -alpha remove -alpha off output.jpg

# Or in Photoshop:
# Levels adjustment: Move white point slider left
```

## Best Practices

### Efficiency Tips

1. **Batch Shoot Sessions**
   - Photograph all products in one session
   - Maintain consistent lighting and setup
   - Don't adjust settings between products

2. **Use Presets**
   - Create Lightroom presets for common adjustments
   - Save Photoshop actions for repetitive tasks
   - Use scripts for batch processing

3. **Organize Immediately**
   - Name files as you shoot (camera setting)
   - Sort and backup daily
   - Keep raw files archived

4. **Quality Over Speed**
   - Take time to get shots right in-camera
   - Fewer post-processing corrections needed
   - Better final results

### File Management

**Naming Convention:**
```
[product-name]-[variant]-[version].[ext]

Examples:
original-mild-1.jpg
original-mild-1.webp
cherry-hot-2.png
choose-3-with-gift-box.webp
```

**Version Control:**
```
v1 = Initial photography
v2 = Re-shoot or significant edit
v3+ = Additional iterations
```

**Backup Strategy:**
```
Local:
- Original RAW files on external drive
- Edited PSD/TIFF files on external drive
- Final exports in project repository

Cloud:
- RAW files: Google Drive/Dropbox
- Finals: CDN + Git repository
```

### Performance Optimization

**Lazy Loading:**
```tsx
<Image
  src="/images/products/salsa.webp"
  loading="lazy"
  alt="Salsa"
/>
```

**Blur Placeholder:**
```tsx
<Image
  src="/images/products/salsa.webp"
  placeholder="blur"
  blurDataURL="/images/products/salsa-blur.jpg"
  alt="Salsa"
/>
```

**CDN Delivery:**
- Use Vercel Image Optimization
- Or CloudFlare Images
- Or imgix for advanced features

## Related Documentation

- [Image Audit Script](../scripts/audit-product-images.ts) - Verify image integrity

## Tools Reference

### Essential Software
- **Adobe Lightroom** - Batch editing, color correction
- **Adobe Photoshop** - Advanced editing, compositing
- **GIMP** - Free alternative to Photoshop
- **Capture One** - Professional RAW processing
- **DxO PhotoLab** - AI-powered corrections

### Online Tools
- **Remove.bg** - Background removal
- **Photopea** - Free online Photoshop alternative
- **Squoosh** - Image compression testing
- **TinyPNG** - PNG/JPG compression

### Command-Line Tools
- **ImageMagick** - Image manipulation
- **Sharp** - Node.js image processing
- **cwebp** - WebP converter
- **optipng** - PNG optimization
- **jpegoptim** - JPEG optimization

### AI Tools
- **Adobe Sensei** - Built into Adobe products
- **Luminar AI** - AI-powered photo editing
- **Topaz Labs** - Upscaling and enhancement
- **Pixelmator Pro** - Mac-native editing with ML

## Additional Resources

**Photography Tutorials:**
- Product Photography 101: https://www.shopify.com/blog/product-photography
- DIY Product Photography: https://www.adobe.com/creativecloud/photography/discover/product-photography.html

**WebP Resources:**
- Google WebP Guide: https://developers.google.com/speed/webp
- Can I Use WebP: https://caniuse.com/webp

**Image Optimization:**
- Web.dev Image Optimization: https://web.dev/fast/#optimize-your-images
- Next.js Image Component: https://nextjs.org/docs/api-reference/next/image
