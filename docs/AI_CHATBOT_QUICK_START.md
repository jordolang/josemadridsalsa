# AI Chatbot Quick Start Guide

## 🚀 5-Minute Setup

Your AI chatbot is **already working** and indexing content from:
- ✅ All products in your database
- ✅ All recipes in your database  
- ✅ All retail locations
- ✅ Markdown files in `/public` folder

**To enhance it with custom knowledge:**

### Step 1: Set Environment Variables (Required)

```bash
# Add to .env.local
OPENAI_API_KEY=sk-...  # Get from https://platform.openai.com/api-keys
OPENAI_MODEL=gpt-4o-mini  # Cost-effective model
```

### Step 2: Access Training Data Admin Panel

```
http://localhost:3000/admin/training-data
```

Login with your admin credentials.

### Step 3: Upload Your First Document

**Option A: Upload a File**
1. Create a file called `faq.md` with common questions
2. Drag and drop it into the "Upload documents" section
3. Wait for status to change to "Ready" (usually instant for text files)

**Option B: Scrape a URL**
1. Find a helpful page on your website or blog
2. Paste the URL into "Scrape a URL" form
3. Click submit and wait for processing

### Step 4: Test the Chatbot

Visit your website and ask the chatbot:
```
"Where can I buy Jose Madrid Salsa?"
"What are your shipping options?"
"How do I start a fundraiser?"
```

---

## 📝 Example Training Documents

### Example 1: Basic FAQ (`faq.md`)

```markdown
# Frequently Asked Questions

## Ordering & Shipping

### How long does shipping take?
Orders typically ship within 1-2 business days. Standard shipping (USPS) takes 3-5 days. Expedited shipping (2-3 days) is available at checkout.

### Do you offer free shipping?
Yes! Orders over $50 qualify for free standard shipping to anywhere in the continental United States.

### Can I track my order?
Absolutely. You'll receive a tracking number via email once your order ships. You can also check your order status in your account dashboard.

## Products

### Are your salsas gluten-free?
Yes, all Jose Madrid salsas are gluten-free, vegan, and contain no artificial preservatives.

### What's the shelf life?
Unopened bottles last 18 months. After opening, refrigerate and consume within 30 days for best quality.

### Which salsa is least spicy?
Our Mild Green Chile is perfect for those who want flavor without heat. It has a heat level of 1 out of 10.

### What's your hottest salsa?
The Ghost Pepper & Habanero salsa is our hottest, with a heat level of 10 out of 10. It's made for serious heat lovers!

## Returns & Refunds

### What's your return policy?
We offer a 30-day money-back guarantee. If you're not satisfied, contact us for a full refund.

### What if my order arrives damaged?
Contact us immediately at support@josemadridsalsa.com with photos. We'll send a replacement at no charge.

## Contact

### How can I reach customer support?
- Email: support@josemadridsalsa.com
- Phone: (555) 123-4567 (Mon-Fri, 9am-5pm EST)
- Live Chat: Available on our website
```

### Example 2: Product Comparisons (`product-guide.md`)

```markdown
# Product Selection Guide

## Choosing by Heat Level

### Mild (Heat 1-3)
- **Mild Green Chile**: Perfect for kids and heat-sensitive palates
- **Classic Tomato**: Traditional salsa taste, minimal heat
Best for: Chips, eggs, chicken

### Medium (Heat 4-6)
- **Garden Fresh**: Balanced heat with vegetable flavor
- **Roasted Garlic**: Savory with moderate kick
Best for: Tacos, burritos, grilled meats

### Hot (Heat 7-8)
- **Jalapeño Fire**: Bold jalapeño flavor
- **Chipotle Smoke**: Smoky heat
Best for: Wings, nachos, marinades

### Extra Hot (Heat 9-10)
- **Habanero Fury**: Intense habanero heat
- **Ghost Pepper & Habanero**: Our hottest offering
Best for: Challenge seekers, small amounts in cooking

## Most Popular Combinations

### Family Pack
- Mild Green Chile (for kids)
- Garden Fresh (medium for everyone)
- Jalapeño Fire (for heat lovers)

### Taco Night Bundle
- Classic Tomato
- Garden Fresh
- Chipotle Smoke

### Heat Seeker Collection
- Jalapeño Fire
- Habanero Fury
- Ghost Pepper & Habanero
```

### Example 3: Fundraising Details (`fundraising-details.md`)

```markdown
# Fundraising Program

## How It Works

1. **Apply**: Contact us to set up your fundraiser
2. **Receive Materials**: We send order forms and promotional flyers
3. **Sell**: Your supporters order directly (2-3 week campaign)
4. **We Ship**: Products ship directly to customers
5. **You Earn**: Receive your portion within 7 days

## Profit Structure

Your organization keeps 40% of all sales:
- $10 salsa → You earn $4
- $50 variety pack → You earn $20
- Sell 100 jars → Earn $400+

## Best Practices

### Most Successful Groups
- Start with 10-20 volunteers
- Set individual goals (20 jars per person)
- Use social media and email
- Host tasting events
- Campaign for 2-3 weeks max

### Marketing Support We Provide
- Professional order forms
- Digital flyer templates
- Social media graphics
- Email templates
- Product samples for tastings (by request)

### Typical Results
- Average participant sells 15-25 jars
- Average fundraiser raises $500-$2,000
- Larger organizations (50+ families) often raise $5,000+

## Getting Started

**Contact Information:**
- Email: fundraising@josemadridsalsa.com
- Phone: (555) 123-4567
- Online Form: https://josemadridsalsa.com/fundraising

**Required Information:**
- Organization name and type (school, church, sports team, etc.)
- Contact person details
- Estimated number of participants
- Target fundraising goal
- Preferred start date

**Timeline:**
- Application review: 1-2 business days
- Material delivery: 5-7 business days
- Recommended campaign length: 2-3 weeks
```

---

## 🎯 Priority Content to Add

Based on common customer questions, add these documents first:

### Week 1: Essential Information
- [ ] FAQ (ordering, shipping, products)
- [ ] Return & refund policy
- [ ] Product comparison guide
- [ ] Allergen information

### Week 2: Programs
- [ ] Fundraising program details
- [ ] Wholesale program guide
- [ ] Gift certificate information
- [ ] Bulk order discounts

### Week 3: Content
- [ ] Recipe ideas using products
- [ ] Serving suggestions
- [ ] Storage and handling tips
- [ ] Company history and story

### Week 4: Support
- [ ] Troubleshooting guide
- [ ] Contact options
- [ ] Store locator help
- [ ] Account management help

---

## 💡 Tips for Great Training Content

### Structure Documents Well
```markdown
✅ Good Structure:
# Main Topic
Brief introduction

## Sub-topic 1
Detailed answer

## Sub-topic 2
Detailed answer

❌ Poor Structure:
Random facts without organization
No headings
Wall of text
```

### Use Natural Language
Write like a helpful employee would speak:
```
✅ "Our salsas last about 18 months unopened. Once you crack one open, 
    keep it in the fridge and it'll stay fresh for about 30 days."

❌ "Shelf life: 18mo unopened. 30d refrigerated post-opening."
```

### Include Variations
Help the AI understand different ways customers ask:
```markdown
## Shipping Questions

### How long does shipping take? / When will my order arrive? / Delivery time?
Standard shipping takes 3-5 business days after your order ships...
```

### Add Context
```markdown
✅ "We ship via USPS Priority Mail, which typically takes 3-5 business 
    days after your order leaves our warehouse. Most orders ship within 
    1-2 business days of being placed."

❌ "3-5 days shipping"
```

---

## 🔧 Troubleshooting

### Chatbot gives generic answers
**Problem**: AI doesn't reference your specific information  
**Solution**: 
1. Check `/admin/training-data` - are documents marked "Ready"?
2. Upload more specific content about the topic
3. Test with exact phrases from your documents

### Documents stuck in "Processing"
**Problem**: Status never changes to "Ready"  
**Solution**:
1. Check file format (should be .txt, .md, .pdf, .docx)
2. Look for error messages in admin panel
3. Try converting to markdown (.md) format
4. Check file size (should be under 10MB)

### AI doesn't know about database content
**Problem**: Products/recipes/locations not working  
**Solution**:
1. Verify data exists in database (`npm run db:studio`)
2. Restart development server (`npm run dev`)
3. Check products are marked `isActive: true`

### Changes not appearing
**Problem**: Updated content not reflected in responses  
**Solution**:
1. Restart server to clear cache
2. Wait 5 minutes for cache to refresh
3. Check document was uploaded/updated successfully

---

## 📊 Monitoring Success

Visit `/admin/training-data` regularly to check:

### Key Metrics
- **Total sources**: Should grow as you add content
- **Ready**: Should be 90%+ of total
- **Needs review**: Review these for accuracy
- **Characters indexed**: More is generally better

### Quality Checks
Test weekly with common questions:
1. Product questions → Should cite specific products
2. Policy questions → Should match your policies exactly
3. Location questions → Should list correct stores
4. Program questions → Should explain accurately

---

## 🚀 Advanced Tips

### Index Your Entire Website
Use the URL scraper to add all public pages:
```
/about
/fundraising  
/wholesale
/products/[each-product-slug]
/recipes/[each-recipe-slug]
```

### Organize by Category
Create topic-specific documents:
```
products-faq.md
shipping-info.md
returns-policy.md
fundraising-guide.md
wholesale-program.md
allergen-info.md
```

### Keep Content Current
Set a monthly reminder to:
- Review training data for outdated info
- Update pricing/policies as they change
- Add new products/recipes
- Archive deprecated content

### Use Markdown Effectively
```markdown
# Use Headers
Break content into scannable sections

## Lists are Great
- Easy to read
- Easy for AI to parse
- Clear information hierarchy

**Bold** important terms
*Italics* for emphasis
`Inline code` for product names or codes
```

---

## ✅ Checklist: Your First 30 Minutes

- [ ] Add `OPENAI_API_KEY` to `.env.local`
- [ ] Restart development server
- [ ] Visit `/admin/training-data`
- [ ] Create `faq.md` with 5-10 common questions
- [ ] Upload `faq.md` via admin panel
- [ ] Verify status shows "Ready"
- [ ] Test chatbot with questions from your FAQ
- [ ] Adjust content based on responses
- [ ] Add 2-3 more documents (shipping, returns, products)
- [ ] Test again and iterate

---

**Need help?** Check the full guide: `docs/AI_CHATBOT_TRAINING_GUIDE.md`
