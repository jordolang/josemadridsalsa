import prisma from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export const postCardSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  excerpt: true,
  coverImage: true,
  coverImageAlt: true,
  publishedAt: true,
  featured: true,
  readingMinutes: true,
  tags: true,
  category: {
    select: { id: true, slug: true, name: true, accentColor: true },
  },
  series: {
    select: { id: true, slug: true, name: true, accentColor: true },
  },
  seriesOrder: true,
  author: {
    select: { id: true, name: true },
  },
} satisfies Prisma.BlogPostSelect

export type PostCard = Prisma.BlogPostGetPayload<{ select: typeof postCardSelect }>

const publishedFilter: Prisma.BlogPostWhereInput = {
  status: 'PUBLISHED',
  publishedAt: { lte: new Date() },
}

export async function getFeaturedPost(): Promise<PostCard | null> {
  return prisma.blogPost.findFirst({
    where: { ...publishedFilter, featured: true },
    orderBy: { publishedAt: 'desc' },
    select: postCardSelect,
  })
}

export async function getLatestPosts(
  options: { take?: number; skip?: number; excludeIds?: string[] } = {}
): Promise<PostCard[]> {
  const { take = 12, skip = 0, excludeIds = [] } = options
  return prisma.blogPost.findMany({
    where: {
      ...publishedFilter,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    take,
    skip,
    select: postCardSelect,
  })
}

export async function countPublishedPosts(where: Prisma.BlogPostWhereInput = {}): Promise<number> {
  return prisma.blogPost.count({ where: { ...publishedFilter, ...where } })
}

export async function getPostBySlug(slug: string) {
  return prisma.blogPost.findFirst({
    where: { slug, ...publishedFilter },
    include: {
      category: true,
      series: true,
      author: { select: { id: true, name: true } },
      reactions: { select: { kind: true } },
      _count: {
        select: {
          comments: { where: { status: 'APPROVED' } },
          reactions: true,
        },
      },
    },
  })
}

export type PostDetail = NonNullable<Awaited<ReturnType<typeof getPostBySlug>>>

export async function getRelatedPosts(post: {
  id: string
  seriesId: string | null
  categoryId: string | null
  tags: string[]
}): Promise<PostCard[]> {
  const candidates = await prisma.blogPost.findMany({
    where: {
      ...publishedFilter,
      id: { not: post.id },
      OR: [
        post.seriesId ? { seriesId: post.seriesId } : undefined,
        post.categoryId ? { categoryId: post.categoryId } : undefined,
        post.tags.length ? { tags: { hasSome: post.tags } } : undefined,
      ].filter(Boolean) as Prisma.BlogPostWhereInput[],
    },
    orderBy: { publishedAt: 'desc' },
    take: 6,
    select: postCardSelect,
  })

  if (candidates.length >= 3) return candidates.slice(0, 3)

  const filler = await prisma.blogPost.findMany({
    where: {
      ...publishedFilter,
      id: { notIn: [post.id, ...candidates.map((p) => p.id)] },
    },
    orderBy: { publishedAt: 'desc' },
    take: 3 - candidates.length,
    select: postCardSelect,
  })

  return [...candidates, ...filler]
}

export async function getSeriesPostsOrdered(seriesId: string): Promise<PostCard[]> {
  return prisma.blogPost.findMany({
    where: { ...publishedFilter, seriesId },
    orderBy: [{ seriesOrder: 'asc' }, { publishedAt: 'asc' }],
    select: postCardSelect,
  })
}

export async function getFeaturedSeries(take = 4) {
  return prisma.blogSeries.findMany({
    where: { isFeatured: true },
    orderBy: { sortOrder: 'asc' },
    take,
    include: {
      _count: {
        select: {
          posts: { where: { status: 'PUBLISHED' } },
        },
      },
    },
  })
}

export async function getAllCategories() {
  return prisma.blogCategory.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { posts: { where: { status: 'PUBLISHED' } } } },
    },
  })
}

export async function getCategoryBySlug(slug: string) {
  return prisma.blogCategory.findUnique({ where: { slug } })
}

export async function getSeriesBySlug(slug: string) {
  return prisma.blogSeries.findUnique({ where: { slug } })
}

export async function getPublishedPostsForFeed(take = 40) {
  return prisma.blogPost.findMany({
    where: publishedFilter,
    orderBy: { publishedAt: 'desc' },
    take,
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      coverImage: true,
      publishedAt: true,
      tags: true,
      category: { select: { name: true } },
    },
  })
}

export async function getAllPublishedSlugs() {
  return prisma.blogPost.findMany({
    where: publishedFilter,
    select: { slug: true, updatedAt: true },
  })
}

export async function getAllSeriesSlugs() {
  return prisma.blogSeries.findMany({ select: { slug: true, updatedAt: true } })
}
