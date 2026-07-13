import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { analyzePage, SeoAnalysis } from '@/lib/seo/analyzer'
import { getSeoConfiguration } from '@/lib/seo/configuration'
import { renderTemplate } from '@/lib/seo/templates'
import { getHeatLevelText } from '@/lib/utils'

export interface AnalyzedPage extends SeoAnalysis {
  type: 'product' | 'recipe' | 'blog-post'
  id: string
  label: string
  path: string
}

const PAGE_LIMIT = 500

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const permitted = await hasPermission(session.user as any, 'seo:manage')
  if (!permitted) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [config, products, recipes, blogPosts] = await Promise.all([
      getSeoConfiguration(),
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          metaTitle: true,
          metaDescription: true,
          featuredImage: true,
          heatLevel: true,
          category: { select: { name: true } },
        },
        take: PAGE_LIMIT,
        orderBy: { name: 'asc' },
      }),
      prisma.recipe.findMany({
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          metaTitle: true,
          metaDescription: true,
          featuredImage: true,
          ogImage: true,
        },
        take: PAGE_LIMIT,
        orderBy: { title: 'asc' },
      }),
      prisma.blogPost.findMany({
        where: { status: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          seoTitle: true,
          seoDescription: true,
          coverImage: true,
        },
        take: PAGE_LIMIT,
        orderBy: { title: 'asc' },
      }),
    ])

    const siteName = config?.siteName || 'Jose Madrid Salsa'
    const keywords = config?.defaultKeywords?.length ? config.defaultKeywords : undefined

    const pages: AnalyzedPage[] = []

    for (const product of products) {
      // Mirror the effective metadata resolution used by the product page:
      // explicit override → configured template → fallback
      const variables = {
        product_name: product.name,
        category: product.category?.name ?? '',
        heat_level: getHeatLevelText(product.heatLevel),
        site_name: siteName,
      }
      const title =
        product.metaTitle ||
        (config?.productTitleTemplate ? renderTemplate(config.productTitleTemplate, variables) : '') ||
        `${product.name} | ${siteName}`
      const description =
        product.metaDescription ||
        (config?.productDescTemplate ? renderTemplate(config.productDescTemplate, variables) : '') ||
        product.description ||
        ''

      pages.push({
        type: 'product',
        id: product.id,
        label: product.name,
        path: `/products/${product.slug}`,
        ...analyzePage({
          title,
          description,
          slug: product.slug,
          image: product.featuredImage,
          keywords,
          hasStructuredData: true, // product pages always emit Product JSON-LD
        }),
      })
    }

    for (const recipe of recipes) {
      const variables = { recipe_name: recipe.title, site_name: siteName }
      const title =
        recipe.metaTitle ||
        (config?.recipeTitleTemplate ? renderTemplate(config.recipeTitleTemplate, variables) : '') ||
        `${recipe.title} | ${siteName}`
      const description =
        recipe.metaDescription ||
        (config?.recipeDescTemplate ? renderTemplate(config.recipeDescTemplate, variables) : '') ||
        recipe.description ||
        ''

      pages.push({
        type: 'recipe',
        id: recipe.id,
        label: recipe.title,
        path: `/recipes/${recipe.slug}`,
        ...analyzePage({
          title,
          description,
          slug: recipe.slug,
          image: recipe.ogImage || recipe.featuredImage,
          keywords,
        }),
      })
    }

    for (const post of blogPosts) {
      pages.push({
        type: 'blog-post',
        id: post.id,
        label: post.title,
        path: `/heat-index/${post.slug}`,
        ...analyzePage({
          title: post.seoTitle || post.title,
          description: post.seoDescription || post.excerpt,
          slug: post.slug,
          image: post.coverImage,
          keywords,
        }),
      })
    }

    // Worst scores first so problems surface at the top
    pages.sort((a, b) => a.score - b.score)

    const summary = {
      pageCount: pages.length,
      averageScore: pages.length
        ? Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length)
        : 100,
      issueCount: pages.reduce((sum, p) => sum + p.recommendations.length, 0),
    }

    return NextResponse.json({ summary, pages })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to run SEO analysis', details: String(error) },
      { status: 500 }
    )
  }
}
