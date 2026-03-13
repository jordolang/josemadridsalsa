# AI Chatbot Training Guide

## Overview

Your AI chatbot uses **RAG (Retrieval Augmented Generation)** to answer customer questions by referencing content from your entire project. The system automatically indexes multiple data sources and retrieves relevant information when customers ask questions.

## How It Works

### 1. **Content Indexing** (`lib/ai-rag/indexer.ts`)
The system automatically indexes content from:
- ✅ **Products** - All active products with descriptions, prices, heat levels, ingredients
- ✅ **Recipes** - Recipe titles, ingredients, instructions, cooking times
- ✅ **Locations** - Retail store information (address, phone, website)
- ✅ **Static Pages** - About, fundraising, wholesale, shipping, contact info
- ✅ **Markdown Files** - Public markdown documents (About, Fundraising, Recipes, Salsas, Wholesale, Contact)
- ✅ **Training Documents** - Manually uploaded files and scraped URLs

### 2. **Content Retrieval** (`lib/ai-rag/retriever.ts`)
When a customer asks a question:
1. The query is analyzed for keywords
2. Content is scored based on relevance
3. Top 5 most relevant pieces of content are selected
4. Context is formatted and sent to the AI

### 3. **AI Response** (`app/api/ai-chat/route.ts`)
The AI receives:
- Customer's question
- Relevant context from your indexed content
- System instructions to be helpful and accurate

## Current Data Sources

### Automatic Sources (No Setup Required)

These sources are **automatically indexed** every time the chatbot is used:

#### Database Content
```typescript
✅ Products (from database)
   - Name, description, price
   - Heat level, ingredients
   - Category information
   
✅ Recipes (from database)
   - Title, description, category
   - Ingredients and instructions
   - Prep time, cook time, servings
   
✅ Retail Locations (from database)
   - Store name, address, city, state
   - Phone, website, county
```

#### Markdown Files (in `/public` folder)
```typescript
✅ About Jose.md
✅ Fundraise With Jose!.md
✅ Fundraiser Testimonials.md
✅ Recipes.md
✅ Salsas.md
✅ Wholesale.md
✅ Contact.md
```

#### Hardcoded Knowledge
```typescript
✅ General shipping information
✅ Fundraising program overview
✅ Wholesale program overview
✅ Contact information
```

### Manual Training Data (Admin Panel)

You can add custom training data through the admin panel at `/admin/training-data`:

#### Upload Documents
Supported file types:
- **Text**: .md, .txt, .markdown, .mdx
- **Office**: .doc, .docx, .rtf
- **PDFs**: .pdf, .epub
- **Data**: .csv, .tsv, .xlsx, .xls, .json
- **Web**: .html, .htm
- **Images**: .jpg, .png, .gif, .bmp, .tiff (for manual transcription)

#### Scrape URLs
- Paste any URL (blog posts, help articles, documentation)
- HTML is automatically cleaned and extracted
- Content is indexed for the AI to reference

## How to Train Your Chatbot

### Method 1: Upload Documents (Recommended)

1. **Navigate to Admin Panel**
   ```
   https://your-domain.com/admin/training-data
   ```

2. **Prepare Your Content**
   - Create markdown files with business FAQs
   - Export product information to CSV
   - Convert policies/procedures to text files

3. **Upload Files**
   - Drag and drop files or click to browse
   - System processes automatically
   - Status updates from PROCESSING → READY

4. **Verify Upload**
   - Check "Recent ingests" table
   - Status should show "Ready"
   - Content preview appears in table

### Method 2: Scrape URLs

1. **Find Trusted Sources**
   - Your website's existing pages
   - Help center articles
   - Blog posts about products
   - Partner information pages

2. **Add URLs in Admin Panel**
   - Paste URL in "Scrape a URL" form
   - System fetches and cleans HTML
   - Text content is extracted

3. **Review Extracted Content**
   - Check the "Recent ingests" table
   - Verify content quality
   - Look for any warnings

### Method 3: Add Markdown to `/public` Folder

1. **Create Markdown Files**
   ```bash
   touch public/FAQ.md
   touch public/Returns-Policy.md
   touch public/Allergen-Info.md
   ```

2. **Update Indexer Configuration**
   Edit `lib/ai-rag/indexer.ts` and add to `PUBLIC_MARKDOWN_SOURCES`:
   ```typescript
   {
     idPrefix: 'public-faq',
     title: 'Frequently Asked Questions',
     type: 'general',
     relativePath: ['public', 'FAQ.md'],
     chunk: true, // Split into sections by headings
   },
   ```

3. **Restart Development Server**
   ```bash
   npm run dev
   ```

### Method 4: Add Programmatic Content

For dynamic business information, edit `lib/ai-rag/indexer.ts`:

```typescript
// Add to indexPages() function
pages.push({
  id: 'custom-business-hours',
  type: 'general' as const,
  title: 'Business Hours',
  content: `Our customer service is available Monday-Friday 9am-5pm EST. 
            Orders are processed within 1-2 business days. 
            For urgent inquiries, call (555) 123-4567.`,
  metadata: {},
})
```

## Best Practices

### Content Organization

**Use Clear Titles**
```markdown
✅ Good: "What is your return policy?"
❌ Bad: "Returns"
```

**Structure with Headers**
```markdown
# Product Information

## Heat Levels
Our salsas range from mild to extra hot...

## Ingredients
All salsas are made with fresh...

## Storage
Store unopened bottles in a cool...
```

**Keep Content Focused**
- One topic per document
- Use bullet points for lists
- Include common variations of questions

### Content Quality

**Be Specific**
```markdown
✅ Good: "We ship via USPS Priority Mail (2-3 days) 
          and UPS Ground (3-5 days)."
❌ Bad: "We ship fast."
```

**Include Keywords**
```markdown
✅ Good: "fundraiser, fundraising, school fundraiser, 
          church fundraiser, organization fundraiser"
```

**Answer Common Questions**
- "Where can I buy?"
- "What's the difference between [product A] and [product B]?"
- "Do you offer discounts?"
- "Is it gluten-free/vegan?"
- "How long does shipping take?"

### File Naming

```bash
✅ Good: wholesale-pricing-tiers.md
✅ Good: allergen-information.md
✅ Good: fundraising-faq.md

❌ Bad: doc1.txt
❌ Bad: untitled.md
```

## Monitoring & Maintenance

### Check Training Data Stats

Visit `/admin/training-data` to see:
- **Total sources**: Number of documents indexed
- **Ready**: Documents available to AI
- **Needs review**: Documents with warnings
- **Characters indexed**: Total content size

### Review Chatbot Performance

1. **Test Common Questions**
   ```
   - "Where can I buy Jose Madrid Salsa?"
   - "What's your hottest salsa?"
   - "How do I start a fundraiser?"
   - "Do you offer wholesale pricing?"
   ```

2. **Check Response Quality**
   - Is the answer accurate?
   - Does it reference correct information?
   - Are links/contact info current?

3. **Update Outdated Content**
   - Delete old training documents
   - Upload updated versions
   - Verify changes take effect

### Troubleshooting

**AI gives generic answers**
- ✅ Add more specific content about the topic
- ✅ Upload FAQs with detailed answers
- ✅ Check that documents are marked "Ready"

**AI doesn't know about new products**
- ✅ Verify products are marked `isActive: true` in database
- ✅ Restart the application to refresh cache
- ✅ Add product information to markdown files

**Content not being indexed**
- ✅ Check file format is supported
- ✅ Look for errors in "Recent ingests" table
- ✅ Try converting to markdown or plain text

## Advanced Configuration

### Adjusting Retrieval Settings

Edit `lib/ai-rag/retriever.ts` to customize:

```typescript
// Change number of results retrieved
const relevant = searchContent(latestQuery, allContent, 5) // Default: 5

// Adjust scoring weights in searchContent()
if (lowerTitle.includes(lowerQuery)) {
  score += 100 // Title match weight
}
```

### Customizing System Prompt

Edit `app/api/ai-chat/route.ts`:

```typescript
const BASE_SYSTEM_PROMPT = `
  You are the Jose Madrid Salsa assistant. 
  [Add custom instructions here]
  Always mention our 30-day money-back guarantee.
  Recommend products based on heat preferences.
`
```

### Caching Content

Content is cached by default in `lib/ai-rag/content-cache.ts`:
- Cache refreshes every 5 minutes
- Reduces database queries
- Improves response time

To clear cache, restart the server:
```bash
npm run dev
```

## Example Training Documents

### Example 1: Product FAQ
```markdown
# Product FAQs

## What makes Jose Madrid Salsa special?
All our salsas are made with fresh, locally-sourced ingredients...

## Which salsa is best for tacos?
For mild tacos, try Mild Green Chile. For spicier options...

## Are your salsas gluten-free?
Yes, all Jose Madrid salsas are gluten-free, vegan...

## How long do opened bottles last?
Refrigerate after opening. Consume within 30 days...
```

### Example 2: Fundraising Information
```markdown
# Fundraising Program Details

## Profit Margins
Organizations typically earn 40-50% profit on each case sold...

## How to Start
1. Contact us at fundraising@josemadridsalsa.com
2. We'll send order forms and promotional materials
3. Sell to supporters for 2-3 weeks
4. Submit orders and we ship directly
5. Receive your earnings within 7 days

## Best Practices
Most successful fundraisers sell 10-50 cases...
```

### Example 3: Shipping & Returns
```markdown
# Shipping Information

## Shipping Methods
- USPS Priority Mail: 2-3 business days
- UPS Ground: 3-5 business days
- Free shipping on orders over $50

## Return Policy
30-day money-back guarantee. If you're not satisfied...

## Damaged Products
Contact us immediately with photos. We'll send replacements...
```

## Environment Setup

### Required Environment Variables

```bash
# In .env.local

# OpenAI (Default provider)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # or gpt-4o for better quality

# Alternative: SmileyFace AI
AI_CHAT_PROVIDER=smileyface  # Optional: defaults to openai
SMILEYFACE_API_KEY=your-key
SMILEYFACE_API_BASE=https://api.smileyface.ai/v1
```

### Database Setup

No additional database setup required! The `TrainingDocument` model is already in your schema:

```bash
# Already migrated - just verify
npx prisma studio
# Navigate to TrainingDocument table
```

## Testing Your Changes

### 1. Test Locally

```bash
# Start dev server
npm run dev

# Visit chatbot
http://localhost:3000
```

### 2. Test RAG System

```bash
# Run training data tests
npx vitest run tests/training-data-api.test.ts
npx vitest run tests/training-extractor.test.ts
```

### 3. Manual Testing

Ask these questions in the chatbot:
```
1. "Where can I buy your salsa?"
   → Should list retail locations

2. "What's in the Habanero salsa?"
   → Should list ingredients

3. "How do I start a fundraiser?"
   → Should explain fundraising program

4. "Do you offer wholesale pricing?"
   → Should explain wholesale program
```

## Next Steps

1. **Add Business-Specific Content**
   - Create `FAQ.md` with top 20 customer questions
   - Add `Returns-Policy.md` with detailed return process
   - Upload `Allergen-Info.md` for dietary restrictions

2. **Scrape Your Existing Website**
   - Add all product pages via URL scraper
   - Import blog post content
   - Index help center articles

3. **Monitor & Iterate**
   - Track common questions in customer support
   - Update training data based on gaps
   - Refine system prompt for better responses

4. **Consider Upgrades** (Future)
   - Implement vector embeddings for semantic search
   - Add conversation memory
   - Integrate with customer support tickets
   - Track analytics on chatbot usage

## Support

For issues or questions:
- Check `/admin/training-data` for document status
- Review logs in console for errors
- Test with simple queries first
- Verify environment variables are set

---

**Your chatbot is ready to learn!** Start by uploading documents or scraping URLs in the admin panel: `/admin/training-data`
