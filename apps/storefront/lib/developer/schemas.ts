import { z } from 'zod'

export const developerContactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(320),
  subject: z
    .string()
    .trim()
    .min(5, 'Subject must be at least 5 characters')
    .max(200)
    .regex(/^[^\r\n]*$/, 'Subject must not contain line breaks'),
  message: z
    .string()
    .trim()
    .min(10, 'Message must be at least 10 characters')
    .max(5000),
})

export type DeveloperContactInput = z.infer<typeof developerContactSchema>

export const developerBlogPostSchema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'Slug must be lowercase alphanumeric with hyphens'
    ),
  excerpt: z.string().trim().min(10).max(500),
  content: z.string().min(50).max(100_000),
  coverImage: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
})

export type DeveloperBlogPostInput = z.infer<typeof developerBlogPostSchema>
