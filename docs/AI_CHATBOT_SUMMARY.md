# AI Chatbot Training System - Summary

## What You Have

Your Jose Madrid Salsa e-commerce platform includes a **fully functional AI chatbot** with RAG (Retrieval Augmented Generation) that can answer customer questions by referencing your business content.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER                                  │
│                  Asks: "Where can I buy?"                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AI CHAT WIDGET                               │
│              (components/chat/ai-chat-widget.tsx)                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API ENDPOINT                                   │
│               (app/api/ai-chat/route.ts)                         │
│                                                                   │
│   1. Receives question                                           │
│   2. Searches indexed content (RAG)                              │
│   3. Formats context for AI                                      │
│   4. Sends to OpenAI with context                                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CONTENT INDEXER                                 │
│              (lib/ai-rag/indexer.ts)                             │
│                                                                   │
│   Automatically indexes:                                         │
│   ├─ 📦 Products (from database)                                │
│   ├─ 🍴 Recipes (from database)                                 │
│   ├─ 📍 Locations (from database)                               │
│   ├─ 📄 Public markdown files                                   │
│   └─ 📚 Training documents (uploaded)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   OPENAI API                                     │
│           (Uses GPT-4o-mini by default)                          │
│                                                                   │
│   Receives: Question + Relevant Context                          │
│   Returns: Accurate, context-aware answer                        │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                       CUSTOMER                                   │
│        Gets answer: "You can find us at..."                      │
└─────────────────────────────────────────────────────────────────┘
```

## Already Indexed Content

Your chatbot **already knows about**:

| Source | What It Includes | Auto-Updated |
|--------|------------------|--------------|
| **Products** | All 27 salsas with descriptions, prices, heat levels, ingredients | ✅ Yes (from DB) |
| **Recipes** | Recipe titles, ingredients, instructions, cook times | ✅ Yes (from DB) |
| **Locations** | Retail store addresses, phone numbers, websites | ✅ Yes (from DB) |
| **Markdown Files** | About, Fundraising, Wholesale, Contact info | ✅ Yes (from /public) |
| **Training Docs** | Custom content you upload | ✅ Yes (from admin uploads) |

## How to Enhance Your Chatbot

### Option 1: Upload Documents (Easiest)
1. Go to `http://localhost:3000/admin/training-data`
2. Drag and drop files:
   - FAQs (markdown or text)
   - Return policy (PDF or Word)
   - Product details (CSV)
   - Any business information
3. Wait for status: PROCESSING → READY
4. Done! Chatbot now references this content

### Option 2: Scrape URLs
1. Go to `http://localhost:3000/admin/training-data`
2. Paste any URL (blog posts, help articles)
3. System extracts and cleans HTML
4. Done! Content is indexed

### Option 3: Add Markdown Files
1. Create `public/FAQ.md`
2. Add to `lib/ai-rag/indexer.ts`:
   ```typescript
   {
     idPrefix: 'public-faq',
     title: 'FAQ',
     type: 'general',
     relativePath: ['public', 'FAQ.md'],
     chunk: true
   }
   ```
3. Restart server
4. Done! Content is indexed

## Environment Setup

**Required** in `.env.local`:
```bash
OPENAI_API_KEY=sk-...  # Get from platform.openai.com
```

**Optional**:
```bash
OPENAI_MODEL=gpt-4o-mini  # Cost-effective, or use gpt-4o for better quality
```

## Example Questions Your Chatbot Can Answer

| Question | Source |
|----------|--------|
| "What's your hottest salsa?" | Products (database) |
| "Do you have recipes using salsa?" | Recipes (database) |
| "Where can I buy your products?" | Locations (database) |
| "How does fundraising work?" | Markdown files or training docs |
| "What's your return policy?" | Training docs (if uploaded) |
| "Are your salsas gluten-free?" | Training docs (if uploaded) |
| "How much does shipping cost?" | Training docs (if uploaded) |

## File Locations Reference

```
josemadridsalsa/
├── app/
│   ├── api/
│   │   ├── ai-chat/route.ts          ← Main chat endpoint
│   │   └── admin/
│   │       └── training-data/route.ts ← Upload/scrape API
│   └── admin/
│       └── training-data/
│           └── page.tsx               ← Admin UI for uploads
├── components/
│   └── chat/
│       └── ai-chat-widget.tsx         ← Customer chat interface
├── lib/
│   └── ai-rag/
│       ├── indexer.ts                 ← Extracts content
│       ├── retriever.ts               ← Searches content
│       └── content-cache.ts           ← Caches content (5 min)
├── public/
│   ├── About Jose.md                  ← Auto-indexed
│   ├── Fundraise With Jose!.md        ← Auto-indexed
│   ├── Recipes.md                     ← Auto-indexed
│   ├── Salsas.md                      ← Auto-indexed
│   ├── Wholesale.md                   ← Auto-indexed
│   └── Contact.md                     ← Auto-indexed
├── prisma/
│   └── schema.prisma                  ← TrainingDocument model
└── docs/
    ├── AI_CHATBOT_QUICK_START.md      ← Start here!
    ├── AI_CHATBOT_TRAINING_GUIDE.md   ← Complete guide
    ├── AI_CHATBOT_ARCHITECTURE.md     ← Technical details
    └── AI_CHATBOT_SUMMARY.md          ← This file
```

## Cost Estimate

With OpenAI's `gpt-4o-mini`:
- **Input**: $0.15 per 1M tokens
- **Output**: $0.60 per 1M tokens

**Typical conversation**:
- Query: ~100 tokens
- Context: ~500 tokens
- Response: ~200 tokens
- **Cost per conversation**: ~$0.0005 (half a cent)

**Monthly estimate**:
- 1,000 conversations/month = ~$0.50
- 10,000 conversations/month = ~$5.00

## Quick Reference Commands

```bash
# Start development
npm run dev

# Check training data in admin
open http://localhost:3000/admin/training-data

# View database
npm run db:studio

# Run tests
npx vitest run tests/training-data-api.test.ts
```

## Status Dashboard

Visit `/admin/training-data` to see:
- **Total sources**: Number of indexed documents
- **Ready**: Documents available to AI
- **Needs review**: Documents with warnings
- **Characters indexed**: Total content size

## Next Steps

1. ✅ **Read the Quick Start** - `docs/AI_CHATBOT_QUICK_START.md`
2. ✅ **Set your OpenAI key** - Add `OPENAI_API_KEY` to `.env.local`
3. ✅ **Upload first document** - Create `faq.md` and upload
4. ✅ **Test the chatbot** - Ask it questions on your site
5. ✅ **Iterate and improve** - Add more content based on gaps

## Common Use Cases

### Customer Support
Upload FAQs, return policies, shipping info → Reduce support tickets

### Product Discovery
Already indexed! Customers can ask "What's your mildest salsa?" or "What goes with chicken?"

### Business Programs
Upload fundraising guide, wholesale info → Customers self-serve program details

### Order Tracking
Future: Integrate with order API → Customers check order status via chat

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Chatbot gives generic answers | Upload more specific content; check documents are "Ready" |
| Documents stuck "Processing" | Check file format; try converting to markdown |
| AI doesn't know about products | Verify products marked `isActive: true`; restart server |
| Changes not appearing | Restart server (cache refreshes every 5 min) |

## Support Resources

- 📚 **Comprehensive Guide**: `docs/AI_CHATBOT_TRAINING_GUIDE.md`
- ⚡ **Quick Start**: `docs/AI_CHATBOT_QUICK_START.md`
- 🏗️ **Technical Docs**: `docs/AI_CHATBOT_ARCHITECTURE.md`
- 💬 **Test Interface**: Chat widget on your site
- 🎛️ **Admin Panel**: `/admin/training-data`

---

**Your chatbot is ready to learn!** The system is fully functional and waiting for you to add business-specific knowledge. Start by uploading a FAQ document with your top 10 customer questions.
