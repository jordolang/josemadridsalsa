// Content retriever for RAG - finds relevant content based on user queries

import type { IndexedContent } from './indexer'

/**
 * Simple text-based search (can be upgraded to embeddings later)
 * Searches for relevant content based on keywords in the query
 */
export function searchContent(
  query: string,
  content: IndexedContent[],
  maxResults: number = 5
): IndexedContent[] {
  const lowerQuery = query.toLowerCase()
  const queryWords = lowerQuery.split(/\s+/).filter((w) => w.length > 2)

  // Score each content item
  const scored = content.map((item) => {
    const lowerTitle = item.title.toLowerCase()
    const lowerContent = item.content.toLowerCase()

    let score = 0

    // Exact title match gets highest score
    if (lowerTitle.includes(lowerQuery)) {
      score += 100
    }

    // Title word matches
    queryWords.forEach((word) => {
      if (lowerTitle.includes(word)) {
        score += 20
      }
      if (lowerContent.includes(word)) {
        score += 10
      }
    })

    // Content match
    if (lowerContent.includes(lowerQuery)) {
      score += 30
    }

    // Type-specific boosts
    if (item.type === 'product' && (lowerQuery.includes('salsa') || lowerQuery.includes('flavor') || lowerQuery.includes('product'))) {
      score += 15
    }
    if (item.type === 'recipe' && (lowerQuery.includes('recipe') || lowerQuery.includes('cook') || lowerQuery.includes('make'))) {
      score += 15
    }
    if (item.type === 'location' && (lowerQuery.includes('store') || lowerQuery.includes('where') || lowerQuery.includes('buy') || lowerQuery.includes('find'))) {
      score += 15
    }

    return { item, score }
  })

  // Sort by score and return top results
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.item)
}

/**
 * Format retrieved content for LLM context
 */
export function formatContextForLLM(retrieved: IndexedContent[]): string {
  if (retrieved.length === 0) {
    return ''
  }

  const sections = retrieved.map((item, idx) => {
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1)
    return `[${typeLabel} ${idx + 1}] ${item.title}\n${item.content}`
  })

  return `\n\nRelevant Information:\n${sections.join('\n\n')}\n\n`
}

