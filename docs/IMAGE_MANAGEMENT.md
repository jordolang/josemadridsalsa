# Image Management Documentation

This document outlines the image management system for the Jose Madrid Salsa e-commerce application.

## Directory Structure

```
public/images/
├── products/           # Product images
│   ├── salsa varieties (31 expected images)
│   └── multi-pack options
├── Hero-image.png     # Main hero image
├── jose_madrid_logo.png
├── salsa-bowl.png
└── placeholder-salsa.jpg  # Fallback image
```

## Product Image Requirements

### File Locations
All product images should be stored in: `/public/images/products/`

### Naming Conventions
Product images follow these patterns:
- Individual salsas: `[product-name]-[variant].jpg|png`
- Multi-packs: `choose-[number].png` or `choose-[number]-with-gift-box.jpg`
- Examples:
  - `original-mild-1.jpg`
  - `cherry-hot.jpg`
  - `choose-3-with-gift-box.jpg`

### Image Specifications
- **Dimensions**: Recommended 400x400px or higher
- **Formats**: JPG, PNG (SVG supported with configuration)
- **File Size**: Optimized for web (typically < 1MB)
- **Aspect Ratio**: 1:1 (square) preferred for consistent display

## Currently Expected Images

### Individual Salsa Products (26 images)
1. `black-bean-corn-poblano-salsa.png`
2. `cherry-hot.jpg`
3. `chipotle-hot.png`
4. `chipotle-queso-1.jpg`
5. `clovis-medium.png`
6. `garden-cilantro-hot-1.jpg`
7. `garden-cilantro-mild-1.jpg`
8. `garlic-olives-1.jpg`
9. `ghost-of-clovis.png`
10. `green-apple.jpg`
11. `hot-salsa-1.jpg`
12. `jamaican-jerk.png`
13. `mango-habanero.png`
14. `mango-mild-1.jpg`
15. `mild.png`
16. `original-hot-1.jpg`
17. `original-mild-1.jpg`
18. `original-x-hot-1.jpg`
19. `peach-mild.png`
20. `pineapple-habanero-1.jpg`
21. `pineapple-mild.png`
22. `raspberry-bbq-1.jpg`
23. `raspberry-mild-1.jpg`
24. `spanish-verde-mild.png`
25. `strawberry-mild-1.jpg`
26. `verde-hot-1.jpg`
27. `verde-xx-hot-1.jpg`

### Multi-Pack Products (4 images)
1. `choose-12.png`
2. `choose-3-with-gift-box.jpg`
3. `choose-5.png`
4. `choose-6.png`

## Database Integration

### Image References in Database
Product images are referenced in the database with paths like:
```
/images/products/[filename]
```

### Seed File Location
Image references are maintained in: `prisma/seed.ts`

Each product has:
- `featuredImage`: Primary image for display
- `images`: JSON array of additional images

## Error Handling

### Fallback System
1. **Primary**: Use `product.featuredImage` if available
2. **Fallback**: Use `/images/placeholder-salsa.jpg` if primary fails
3. **Component Level**: React state manages image load errors

### Implementation
```tsx
const [imageError, setImageError] = useState(false)

<Image
  src={imageError || !product.featuredImage ? '/images/placeholder-salsa.jpg' : product.featuredImage}
  onError={() => setImageError(true)}
/>
```

## Adding New Product Images

### Step-by-Step Process
1. **Prepare Image**
   - Resize to 400x400px minimum
   - Optimize file size (use tools like ImageOptim)
   - Save in JPG or PNG format

2. **Upload to Directory**
   - Place in `/public/images/products/`
   - Follow naming convention

3. **Update Database**
   - Add reference to `prisma/seed.ts`
   - Update both `featuredImage` and `images` fields
   - Run `npm run db:seed` to update database

4. **Validate**
   - Run image audit: `node image-audit.js`
   - Test in development environment
   - Verify no console errors

## Troubleshooting

### Common Issues

#### Missing Images (404 Errors)
**Symptoms**: Console shows 404 errors for image files
**Solution**: 
1. Run `node image-audit.js` to identify missing files
2. Create missing images or copy from similar products
3. Use ImageMagick for quick placeholders:
   ```bash
   magick -size 400x400 xc:#COLOR -gravity center -pointsize 20 -fill white -annotate +0+0 "Product Name" filename.jpg
   ```

#### Incorrect File Extensions
**Symptoms**: Database expects `.jpg` but file is `.png`
**Solution**:
1. Either rename the file to match database expectation
2. Or update database reference to match actual file

#### Small/Empty Files
**Symptoms**: Images showing as very small files (< 1KB)
**Solution**:
1. These are likely placeholder files that need replacement
2. Create proper images or copy from similar products

### Image Audit Tool
Use the included audit script to identify issues:
```bash
node image-audit.js
```

This will show:
- Missing images
- Small/placeholder files  
- Unused images
- Suggested fixes

## Best Practices

1. **Consistency**: Maintain consistent dimensions and quality
2. **Optimization**: Compress images for web without losing quality
3. **Naming**: Use descriptive, URL-friendly names
4. **Backup**: Keep original high-resolution images for future use
5. **Testing**: Always test image loading after changes
6. **Documentation**: Update this document when adding new image patterns

## File Maintenance

### Regular Tasks
- Monthly audit using `node image-audit.js`
- Remove unused images
- Optimize file sizes
- Update placeholder images with actual product photos

### Before Deployment
- Verify all product images load correctly
- Check console for 404 errors
- Ensure fallback images are working
- Test on different screen sizes

## Technical Configuration

### Next.js Image Configuration
Located in `next.config.mjs`:
```javascript
images: {
  remotePatterns: [...],
  // Add SVG support if needed:
  // dangerouslyAllowSVG: true,
}
```

### Component Usage
Product images are displayed using Next.js optimized Image component with:
- Automatic optimization
- Lazy loading
- Responsive sizing
- Error handling with fallbacks