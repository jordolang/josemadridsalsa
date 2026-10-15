import { createFromSource } from 'fumadocs-core/search/server';
import { source } from '@/lib/source';

// Full-text search over every docs page. The storefront /help page queries this
// and keeps only results under /docs/help, the customer-facing section.
export const { GET } = createFromSource(source);
