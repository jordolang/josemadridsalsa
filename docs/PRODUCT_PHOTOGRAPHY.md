# Product Photography Guide: Glass Jar Salsa Products

This guide documents the established workflow for capturing, editing, and optimizing product photography for Jose Madrid Salsa's glass jar products. This workflow has been successfully used to create professional product images for the e-commerce website.

## Table of Contents

1. [Photo Specifications](#photo-specifications)
2. [AI Editing Workflow](#ai-editing-workflow)
3. [Batch Processing System](#batch-processing-system)
4. [Web Optimization (WebP)](#web-optimization-webp)

---

## Photo Specifications

### Equipment Setup

**Minimum Required Equipment:**
- Camera: DSLR, mirrorless, or high-quality smartphone (12MP+)
- Lighting: 2-3 softbox lights or natural diffused light
- Background: White seamless paper or foam board (pure white)
- Tripod: Stable mount for consistent framing across all products
- Cleaning supplies: Microfiber cloth for glass jars

**Professional Setup (Recommended):**
- Camera: Full-frame DSLR (Canon 5D, Nikon D850, Sony A7)
- Lens: 50mm f/1.8 or 100mm macro for detail
- Lighting: 3-point lighting setup with softboxes
- Light meter: For consistent exposure across sessions
- Color checker: X-Rite ColorChecker for accurate color calibration

### Camera Settings

**Standard Settings for Glass Jar Products:**
```
Mode: Manual (M)
ISO: 100-200 (minimize noise, maximize sharpness)
Aperture: f/8-f/11 (sharp focus throughout product)
Shutter Speed: 1/125s or faster
White Balance: Custom or 5500K (daylight)
Format: RAW + JPEG (RAW for editing flexibility)
Color Space: sRGB (optimized for web display)
```

**Focus Settings:**
- Use manual focus or single-point autofocus
- Focus on the product label (critical detail area)
- Ensure label text is sharp and readable
- Focus stacking optional for increased depth of field

### Lighting Setup

**Three-Point Lighting Configuration:**

1. **Key Light** (Primary)
   - Position: 45° angle, slightly above product
   - Purpose: Main illumination source
   - Intensity: Brightest light in setup

2. **Fill Light** (Secondary)
   - Position: Opposite side from key light
   - Purpose: Soften shadows, reduce contrast
   - Intensity: 50-70% of key light power

3. **Back Light** (Optional)
   - Position: Behind product, slightly above
   - Purpose: Rim lighting, separate product from background
   - Intensity: Subtle, avoid overexposure

**Lighting Goals:**
- Even, diffused illumination across glass jar
- No harsh shadows on white background
- Minimize reflections on glass surface
- Consistent lighting across all product shots

### Composition & Framing

**Standard Product Shot Guidelines:**

```
Dimensions: 1200x1200px minimum (square format)
Aspect Ratio: 1:1 (square)
Resolution: 72-150 DPI for web
Product Fill: 60-70% of frame
Safe Margin: 10% border around product
```

**Positioning Rules:**
- Product centered in frame
- Straight-on angle (eye-level to product center)
- Label facing camera, fully readable and straight
- Consistent positioning across all products
- Cap/lid visible and oriented forward

### Product Staging for Glass Jars

**Pre-Photography Checklist:**

1. **Clean the jar thoroughly**
   - Remove fingerprints, dust, and smudges with microfiber cloth
   - Check for condensation inside jar
   - Ensure glass is crystal clear

2. **Label inspection**
   - Verify label is straight and properly aligned
   - Check for damage, wrinkles, or peeling
   - Remove any price stickers or retail tags

3. **Product presentation**
   - Position cap/lid consistently (facing forward)
   - Check for air bubbles in salsa (minimize if possible)
   - Ensure salsa fill level is consistent and appealing

4. **Multi-pack staging** (for gift sets)
   - Arrange jars in visually pleasing composition
   - Stagger heights if multiple rows needed
   - Ensure all labels are clearly visible
   - Use consistent spacing between jars
   - Include gift box if applicable to product

**Props Guidelines:**
- Props are optional and should enhance, not distract
- Use neutral white or wooden bowls for salsa display
- Tortilla chips (natural color, minimal seasoning)
- Fresh ingredients (tomatoes, peppers, cilantro)
- Keep minimal—product is the hero

---

## AI Editing Workflow

### When to Use AI Editing

**Recommended AI Use Cases:**
- Background removal and cleanup
- Shadow enhancement and adjustment
- Color correction and consistency
- Minor blemish removal (dust, small imperfections)
- Batch consistency adjustments across products

**What NOT to Do:**
- Generate fake or synthetic product photos
- Significantly alter product appearance or color
- Misrepresent product size or contents
- Create entirely AI-generated images

### AI Editing Prompts

#### 1. Background Removal

**Tool:** Photoshop AI, Remove.bg, or similar

**Prompt:**
```
Remove background completely, keep only the salsa jar.
Preserve jar transparency and natural glass reflections.
Output as PNG with alpha channel for compositing.
Maintain crisp edges around jar and label.
```

**Settings:**
- Output format: PNG with transparency
- Edge refinement: High
- Preserve reflections: Yes

#### 2. Color Enhancement

**Tool:** Adobe Sensei, Luminar AI, or Lightroom AI

**Prompt:**
```
Enhance vibrant salsa colors naturally.
Maintain realistic product appearance—no oversaturation.
Boost label readability and text contrast.
Preserve natural glass jar reflections and highlights.
Match color temperature to other product photos (5500K daylight).
Ensure reds remain true to product (not overly orange or pink).
```

**Target Adjustments:**
- Vibrance: +15 to +20
- Saturation: +5 to +10
- Clarity: +10 to +15
- Label sharpness: Enhanced
- White balance: Consistent across all images

#### 3. Shadow Generation

**Tool:** AI Shadow Generator, Photoshop Neural Filters

**Prompt:**
```
Add subtle, natural product shadow beneath jar.
Shadow direction: bottom center, slight offset to right.
Shadow opacity: 30-40% for realism.
Shadow blur: 15-20px radius (soft edge).
Shadow should appear natural, not harsh or artificial.
Ground plane shadow only (no vertical shadows).
```

**Shadow Specifications:**
- Type: Contact shadow (ground plane)
- Opacity: 30-40%
- Blur radius: 15-20px
- Offset: 2-5px from jar base
- Color: Neutral gray (#000000 with opacity)

#### 4. Image Upscaling

**Tool:** Topaz Gigapixel AI, Let's Enhance, or Upscayl

**Prompt:**
```
Upscale image to 2400x2400px for high-quality display.
Preserve sharp edges on all label text and graphics.
Maintain jar transparency, highlights, and reflections.
Enhance product details without introducing artifacts.
Output format: PNG at highest quality setting.
Prioritize text sharpness over smoothing.
```

**Upscaling Parameters:**
- Target size: 2400x2400px (or higher)
- Quality: Maximum
- Noise reduction: Minimal (preserve texture)
- Detail enhancement: Medium

#### 5. Batch Consistency Analysis

**Tool:** ChatGPT, Claude, or visual AI analysis

**Prompt to AI:**
```
Analyze these [NUMBER] product photos and identify inconsistencies in:

1. Background color and tone
2. Lighting direction and intensity
3. Product positioning and size within frame
4. Color temperature (warmth/coolness)
5. Shadow placement and intensity
6. Focus sharpness and depth of field

For each image, provide specific adjustment recommendations to achieve
visual consistency across the entire product line. Flag any images that
need reshooting vs. post-processing fixes.
```

**Use this for:**
- Quality control across product line
- Identifying outliers before final export
- Ensuring brand consistency
- Pre-deployment image review

### Recommended AI Tools by Function

**Background Removal:**
- Remove.bg (fast, automated, web-based)
- Adobe Photoshop (AI-powered Select Subject)
- Photoshop Express (mobile quick removal)

**Color Enhancement:**
- Adobe Lightroom AI (batch presets)
- Luminar AI (one-click enhancements)
- Pixelmator Pro (Mac-native with ML)

**Image Upscaling:**
- Topaz Gigapixel AI (professional quality)
- Let's Enhance (web-based, good results)
- Upscayl (free, open-source alternative)

**Batch Processing:**
- Adobe Bridge + Photoshop Actions
- Lightroom Classic (presets and sync)
- Capture One (styles and batch export)

---

## Batch Processing System

### Directory Structure

**Organized workflow structure for efficient batch processing:**

```
photography/
├── raw/                          # Original files from camera
│   ├── session-2024-01-15/      # Dated sessions
│   ├── session-2024-01-22/
│   └── session-2024-02-03/
├── edited/                       # Post-processed working files
│   ├── original-mild.psd
│   ├── cherry-hot.psd
│   └── mango-habanero.psd
├── exports/                      # Final output files
│   ├── jpg/                     # High-quality JPEG
│   ├── png/                     # PNG with transparency
│   └── webp/                    # Optimized WebP for web
└── archive/                      # Long-term backup storage
    ├── 2024-01/
    └── 2024-02/
```

### Batch Processing Workflow

#### Phase 1: Import & Organization

```bash
# Create session directory with date
mkdir -p photography/raw/session-$(date +%Y-%m-%d)

# Import photos from camera/SD card
cp /path/to/camera/* photography/raw/session-$(date +%Y-%m-%d)/

# Navigate to session directory
cd photography/raw/session-$(date +%Y-%m-%d)

# Review and rename files to match product names
# Example: DSC_0001.jpg → original-mild-1.jpg
```

**File Naming Convention:**
```
[product-name]-[variant]-[version].[ext]

Examples:
- original-mild-1.jpg
- cherry-hot-1.jpg
- choose-3-with-gift-box.jpg
- mango-habanero-2.webp  (version 2, re-shoot)
```

#### Phase 2: Batch Edit in Lightroom

**Step 1: Import to Lightroom**
- Create collection: "Jose Madrid Salsa - Session [Date]"
- Import all RAW files from session
- Add metadata: Copyright, keywords (salsa, product, Jose Madrid)

**Step 2: Create & Apply Base Preset**

Create preset named: **Jose_Madrid_Salsa_Base**

```
Settings:
- White Balance: 5500K (Temp), +5 Tint
- Exposure: +0.3 to +0.5 (adjust for brightness)
- Contrast: +10
- Highlights: -10 (preserve label highlights)
- Shadows: +15 (lift dark areas)
- Whites: +5
- Blacks: -5
- Clarity: +15 (enhance product detail)
- Vibrance: +20 (boost salsa colors)
- Saturation: +5
- Sharpening: Amount 50, Radius 1.0
- Noise Reduction: Luminance 10 (minimal)
```

**Step 3: Apply to All Images**
1. Select all images in collection
2. Apply "Jose_Madrid_Salsa_Base" preset
3. Review each image individually
4. Make product-specific adjustments as needed
5. Ensure label text is sharp and readable on all images

**Step 4: Export Settings**

```
Format: JPEG
Quality: 90 (high quality for further processing)
Color Space: sRGB (web standard)
Resize to Fit: Long Edge 1200px
Resolution: 72 PPI (web display)
Sharpening: Standard, For Screen
Metadata: Copyright only (remove camera data)
Output location: photography/edited/jpg/
```

#### Phase 3: Background Removal (Batch)

**Option A: Photoshop Batch Action**

1. **Record Photoshop Action:** "Remove_Background_Salsa"
   ```
   Steps to record:
   1. Open image
   2. Select > Subject (AI selection of jar)
   3. Select > Inverse
   4. Delete (removes background)
   5. Layer > Matting > Defringe (1-2px)
   6. File > Export > Quick Export as PNG
   7. Close without saving
   ```

2. **Run Batch Process:**
   ```
   File > Automate > Batch
   - Action: "Remove_Background_Salsa"
   - Source: Folder (photography/edited/jpg)
   - Destination: Folder (photography/exports/png)
   - Override "Save As" commands: Yes
   ```

**Option B: Remove.bg API (Faster for large batches)**

```bash
# Using remove.bg CLI tool
for img in photography/edited/jpg/*.jpg; do
  filename=$(basename "$img" .jpg)
  removebg "$img" "photography/exports/png/${filename}.png"
done
```

#### Phase 4: WebP Conversion (Batch)

See detailed [WebP Optimization](#web-optimization-webp) section below.

### Command-Line Batch Processing

#### Using ImageMagick

**Batch resize and optimize script:**

```bash
#!/bin/bash
# File: batch-process-salsa-images.sh

INPUT_DIR="photography/edited/jpg"
OUTPUT_JPG="photography/exports/jpg"
OUTPUT_PNG="photography/exports/png"
OUTPUT_WEBP="photography/exports/webp"

# Create output directories
mkdir -p "$OUTPUT_JPG" "$OUTPUT_PNG" "$OUTPUT_WEBP"

# Process all images
for img in "$INPUT_DIR"/*.jpg; do
  filename=$(basename "$img" .jpg)

  echo "Processing: $filename"

  # Resize and optimize JPG (1200x1200)
  convert "$img" \
    -resize 1200x1200 \
    -quality 90 \
    -strip \
    "$OUTPUT_JPG/$filename.jpg"

  # Create PNG with white background (1200x1200)
  convert "$img" \
    -resize 1200x1200 \
    -background white \
    -alpha remove \
    -strip \
    "$OUTPUT_PNG/$filename.png"

  echo "✓ Processed: $filename"
done

echo ""
echo "✅ Batch processing complete!"
echo "JPG files: $OUTPUT_JPG"
echo "PNG files: $OUTPUT_PNG"
```

**Run the script:**
```bash
chmod +x batch-process-salsa-images.sh
./batch-process-salsa-images.sh
```

#### Using Sharp (Node.js)

**Create: `scripts/batch-process-products.js`**

```javascript
// Batch process product images with Sharp
const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')

async function batchProcessProducts() {
  const inputDir = './photography/edited/jpg'
  const outputBase = './photography/exports'

  // Ensure output directories exist
  await fs.mkdir(path.join(outputBase, 'jpg'), { recursive: true })
  await fs.mkdir(path.join(outputBase, 'png'), { recursive: true })
  await fs.mkdir(path.join(outputBase, 'webp'), { recursive: true })

  const files = await fs.readdir(inputDir)
  const imageFiles = files.filter(f => /\.(jpg|jpeg)$/i.test(f))

  console.log(`🔄 Processing ${imageFiles.length} product images...\n`)

  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file)
    const name = path.parse(file).name

    // Process to JPG (1200x1200, quality 90)
    await sharp(inputPath)
      .resize(1200, 1200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .jpeg({ quality: 90, progressive: true })
      .toFile(path.join(outputBase, 'jpg', `${name}.jpg`))

    // Process to PNG (1200x1200)
    await sharp(inputPath)
      .resize(1200, 1200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outputBase, 'png', `${name}.png`))

    // Process to WebP (1200x1200, quality 85)
    await sharp(inputPath)
      .resize(1200, 1200, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .webp({ quality: 85, effort: 6 })
      .toFile(path.join(outputBase, 'webp', `${name}.webp`))

    console.log(`✓ ${name}`)
  }

  console.log(`\n✅ Batch processing complete!`)
  console.log(`Images saved to: ${outputBase}`)
}

batchProcessProducts().catch(console.error)
```

**Run the script:**
```bash
npm install sharp
node scripts/batch-process-products.js
```

### Quality Control Checklist

**Before Processing:**
- [ ] All raw files backed up to external drive
- [ ] Consistent naming convention followed
- [ ] Session organized in dated directory

**During Processing:**
- [ ] Base preset applied to all images
- [ ] Individual adjustments made where needed
- [ ] Background is pure white (#FFFFFF)
- [ ] Labels are sharp and readable
- [ ] Colors consistent across all products

**After Processing:**
- [ ] All exports completed successfully
- [ ] File sizes within target ranges (see WebP section)
- [ ] No visible artifacts or quality loss
- [ ] Files named correctly and match database references
- [ ] Sample images tested in browser

---

## Web Optimization (WebP)

### Why WebP for Salsa Product Photography?

**Benefits of WebP format:**
- **25-35% smaller file size** than JPEG at same visual quality
- **Supports transparency** like PNG (for removed backgrounds)
- **Faster page load times** critical for e-commerce conversion
- **Universal browser support** in all modern browsers
- **Better compression** algorithms preserve product detail
- **Progressive loading** supported for better UX

**When to Use WebP:**
- ✅ All product photography (primary format)
- ✅ Product thumbnails in grid view
- ✅ Product detail/zoom images
- ✅ Hero images and marketing materials
- ✅ Gallery images

**Fallback Strategy:**
- Keep JPEG versions for older browsers
- Use Next.js `<Image>` component (automatic WebP serving)
- Or use `<picture>` element for manual fallback

### WebP Quality Guidelines by Use Case

**Product Thumbnails (Grid View):**
```
Quality: 75-80
Size: 400x400px
Target File Size: 15-25KB
Use Case: Product listing pages, category grids
```

**Product Detail Images:**
```
Quality: 85-90
Size: 800x800px
Target File Size: 40-70KB
Use Case: Product detail pages, zoom functionality
```

**Hero Images:**
```
Quality: 90-95
Size: 1920x1080px
Target File Size: 100-150KB
Use Case: Homepage banners, promotional sections
```

**High-Quality Gallery:**
```
Quality: 95
Size: 2400x2400px
Target File Size: 200-300KB
Use Case: Downloadable images, print-quality needs
```

### WebP Conversion Tools

#### Command-Line Conversion (cwebp)

**Install cwebp:**

```bash
# macOS (Homebrew)
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

**Advanced Conversion (Recommended):**
```bash
cwebp input.jpg \
  -q 85 \              # Quality (0-100)
  -m 6 \               # Compression method (0-6, higher=slower but better)
  -af \                # Auto-filter for best compression
  -progress \          # Show progress during conversion
  -mt \                # Use multi-threading (faster)
  -o output.webp
```

**Batch Conversion Script:**

```bash
#!/bin/bash
# File: convert-to-webp.sh
# Convert all product images to WebP

INPUT_DIR="./photography/exports/jpg"
OUTPUT_DIR="./photography/exports/webp"

mkdir -p "$OUTPUT_DIR"

echo "🔄 Converting product images to WebP..."
echo ""

for img in "$INPUT_DIR"/*.jpg; do
  filename=$(basename "$img" .jpg)

  cwebp -q 85 -m 6 -af -mt \
    "$img" \
    -o "$OUTPUT_DIR/${filename}.webp"

  # Show file size comparison
  original_size=$(stat -f%z "$img")
  webp_size=$(stat -f%z "$OUTPUT_DIR/${filename}.webp")
  savings=$(echo "scale=1; (($original_size - $webp_size) / $original_size) * 100" | bc)

  echo "✓ $filename"
  echo "  Original: $(echo "scale=1; $original_size / 1024" | bc)KB"
  echo "  WebP: $(echo "scale=1; $webp_size / 1024" | bc)KB"
  echo "  Savings: ${savings}%"
  echo ""
done

echo "✅ WebP conversion complete!"
```

#### Node.js WebP Conversion with Sharp

**Create: `scripts/optimize-to-webp.js`**

```javascript
// Convert and optimize product images to WebP format
const sharp = require('sharp')
const fs = require('fs').promises
const path = require('path')

async function optimizeToWebP(inputDir, quality = 85) {
  const stats = []

  const files = await fs.readdir(inputDir)
  const imageFiles = files.filter(f => /\.(jpg|jpeg|png)$/i.test(f))

  console.log(`🔄 Converting ${imageFiles.length} images to WebP...\n`)

  for (const file of imageFiles) {
    const inputPath = path.join(inputDir, file)
    const name = path.parse(file).name
    const outputPath = path.join(inputDir, `${name}.webp`)

    // Get original file size
    const originalStats = await fs.stat(inputPath)
    const originalSize = originalStats.size

    // Convert to WebP with optimal settings
    await sharp(inputPath)
      .webp({
        quality: quality,      // Quality setting (0-100)
        effort: 6,             // Compression effort (0-6, higher=slower but better)
        smartSubsample: true   // Better color preservation
      })
      .toFile(outputPath)

    // Get WebP file size
    const webpStats = await fs.stat(outputPath)
    const webpSize = webpStats.size

    // Calculate savings
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

  // Summary statistics
  const totalOriginal = stats.reduce((sum, s) => sum + s.originalSize, 0)
  const totalWebP = stats.reduce((sum, s) => sum + s.webpSize, 0)
  const totalSavings = ((totalOriginal - totalWebP) / totalOriginal * 100).toFixed(1)

  console.log('=== CONVERSION SUMMARY ===')
  console.log(`Images converted: ${stats.length}`)
  console.log(`Total original size: ${(totalOriginal / 1024).toFixed(1)}KB`)
  console.log(`Total WebP size: ${(totalWebP / 1024).toFixed(1)}KB`)
  console.log(`Total savings: ${totalSavings}%`)
  console.log(`Average savings per image: ${(stats.reduce((sum, s) => sum + s.savings, 0) / stats.length).toFixed(1)}%`)
}

// Run conversion
const inputDir = path.join(process.cwd(), 'public', 'images', 'products')
optimizeToWebP(inputDir, 85).catch(console.error)
```

**Run the script:**
```bash
npm install sharp
node scripts/optimize-to-webp.js
```

### Implementing WebP in Next.js

#### Option 1: Automatic WebP with Next.js Image Component

**Next.js automatically serves WebP when available:**

```tsx
import Image from 'next/image'

export default function ProductCard({ product }) {
  return (
    <Image
      src={product.featuredImage}  // Can be .jpg, .png, etc.
      alt={product.name}
      width={400}
      height={400}
      quality={85}
      // Next.js automatically serves WebP to supporting browsers
      // No additional configuration needed
    />
  )
}
```

**Benefits:**
- Automatic format selection (WebP, JPEG, PNG)
- Responsive image sizing
- Lazy loading built-in
- Optimization on-demand

#### Option 2: Manual WebP with Fallback

**Using `<picture>` element for explicit control:**

```tsx
export default function ProductImage({ product }) {
  return (
    <picture>
      {/* WebP for modern browsers */}
      <source
        srcSet={`/images/products/${product.slug}.webp`}
        type="image/webp"
      />

      {/* JPEG fallback for older browsers */}
      <source
        srcSet={`/images/products/${product.slug}.jpg`}
        type="image/jpeg"
      />

      {/* Fallback img tag */}
      <img
        src={`/images/products/${product.slug}.jpg`}
        alt={product.name}
        width={400}
        height={400}
        loading="lazy"
      />
    </picture>
  )
}
```

#### Option 3: Responsive WebP Images

**Multiple sizes for different viewports:**

```tsx
<picture>
  {/* Desktop: Large WebP */}
  <source
    media="(min-width: 768px)"
    srcSet="/images/products/salsa-800.webp"
    type="image/webp"
  />

  {/* Desktop: Large JPEG fallback */}
  <source
    media="(min-width: 768px)"
    srcSet="/images/products/salsa-800.jpg"
    type="image/jpeg"
  />

  {/* Mobile: Small WebP */}
  <source
    srcSet="/images/products/salsa-400.webp"
    type="image/webp"
  />

  {/* Mobile: Small JPEG fallback */}
  <img
    src="/images/products/salsa-400.jpg"
    alt="Jose Madrid Salsa"
    loading="lazy"
  />
</picture>
```

### WebP Testing & Quality Validation

**Test Different Quality Levels:**

```bash
# Generate test images at different quality settings
cwebp input.jpg -q 75 -o output-q75.webp
cwebp input.jpg -q 80 -o output-q80.webp
cwebp input.jpg -q 85 -o output-q85.webp
cwebp input.jpg -q 90 -o output-q90.webp
cwebp input.jpg -q 95 -o output-q95.webp

# Compare file sizes
ls -lh output-q*.webp

# Visual comparison: Open all in browser/image viewer
```

**Recommended Quality by Product Type:**
- Standard salsa jars: **85** (best balance)
- Multi-pack sets: **85-90** (more detail needed)
- Lifestyle/marketing images: **90**
- Technical/print quality: **95**

**Quality Validation Checklist:**
- [ ] Label text is sharp and readable
- [ ] Salsa colors appear natural and vibrant
- [ ] Glass jar reflections preserved
- [ ] No visible compression artifacts
- [ ] File size within target range
- [ ] Visual quality acceptable on mobile and desktop

### Performance Optimization Tips

**1. Lazy Loading:**
```tsx
<Image
  src="/images/products/salsa.webp"
  loading="lazy"  // Only load when near viewport
  alt="Salsa Product"
/>
```

**2. Blur Placeholder (LQIP):**
```tsx
<Image
  src="/images/products/salsa.webp"
  placeholder="blur"
  blurDataURL="data:image/webp;base64,..."  // Tiny base64 image
  alt="Salsa Product"
/>
```

**3. Priority Loading (Above-the-fold images):**
```tsx
<Image
  src="/images/hero-salsa.webp"
  priority  // Load immediately, no lazy loading
  alt="Hero Salsa"
/>
```

**4. CDN Delivery:**
- Use Vercel's built-in Image Optimization (automatic with Next.js)
- Or CloudFlare Images for advanced caching
- Or imgix for dynamic image transformations

### Troubleshooting WebP Issues

**Issue: WebP files too large**

**Solution:**
```bash
# Lower quality setting (try 80 instead of 85)
cwebp -q 80 input.jpg -o output.webp

# Use more aggressive compression
cwebp -q 85 -m 6 -af input.jpg -o output.webp

# Check source image—may already be over-compressed
identify -verbose input.jpg | grep Quality
```

**Issue: WebP not loading in browser**

**Solution:**
```tsx
// Ensure proper fallback is in place
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Salsa" />  {/* Fallback */}
</picture>

// Or use Next.js Image (handles automatically)
<Image src="/images/salsa.jpg" ... />
```

**Issue: Quality loss in WebP conversion**

**Solution:**
```bash
# Increase quality setting (90 or 95)
cwebp -q 95 -m 6 input.jpg -o output.webp

# Or use lossless WebP (much larger files)
cwebp -lossless input.png -o output.webp
```

---

## Quick Reference

### Essential Commands

```bash
# Batch convert JPG to WebP (quality 85)
for img in *.jpg; do cwebp -q 85 -m 6 "$img" -o "${img%.jpg}.webp"; done

# Create directory structure
mkdir -p photography/{raw,edited,exports/{jpg,png,webp},archive}

# Resize image to 1200x1200
convert input.jpg -resize 1200x1200 output.jpg

# Remove background with ImageMagick (simple)
convert input.jpg -fuzz 10% -transparent white output.png
```

### File Naming Convention

```
[product-name]-[variant]-[version].[ext]

Examples:
✓ original-mild-1.jpg
✓ cherry-hot-2.webp
✓ choose-3-with-gift-box.jpg
✗ IMG_0001.jpg (bad)
✗ product.jpg (bad)
```

### Recommended Settings Summary

| Aspect | Specification |
|--------|--------------|
| Camera Mode | Manual (M) |
| ISO | 100-200 |
| Aperture | f/8 - f/11 |
| White Balance | 5500K |
| Export Size | 1200x1200px |
| WebP Quality | 85 |
| Target File Size | 40-70KB (detail images) |
| Color Space | sRGB |

### Quality Control

**Before Photography:**
- [ ] Equipment clean and ready
- [ ] Lighting consistent and tested
- [ ] Products cleaned and staged
- [ ] Camera settings configured

**After Processing:**
- [ ] Colors accurate and consistent
- [ ] Labels sharp and readable
- [ ] File sizes within targets
- [ ] Proper naming convention
- [ ] WebP conversion successful

**Before Deployment:**
- [ ] Images in correct directory (`/public/images/products/`)
- [ ] File names match database references
- [ ] No console errors (404s)
- [ ] Images load on mobile and desktop
- [ ] WebP serving correctly with fallback

---

## Related Documentation

- [PRODUCT_PHOTOGRAPHY_WORKFLOW.md](./PRODUCT_PHOTOGRAPHY_WORKFLOW.md) - Detailed technical workflow
- [IMAGE_MANAGEMENT.md](./IMAGE_MANAGEMENT.md) - Image management system
- [Next.js Image Component Docs](https://nextjs.org/docs/api-reference/next/image)
- [Google WebP Guide](https://developers.google.com/speed/webp)

---

**Document Version:** 1.0
**Last Updated:** February 2024
**Maintained by:** Jose Madrid Salsa Development Team
