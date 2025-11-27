import { defineConfig, defineDocs } from 'fumadocs-mdx/config'
import { z } from 'zod'

const docFrontmatter = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  visibility: z.enum(['public', 'developer']).default('public'),
  tags: z.array(z.string()).optional(),
})

export const docs = defineDocs({
  dir: 'docs',
  docs: {
    schema: docFrontmatter,
  },
})

export default defineConfig({
  mdxOptions: {
    rehypePlugins: [],
    remarkPlugins: [],
  },
})
