import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail, parsePagination } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { z } from 'zod'

const recipeSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  prepTime: z.string().min(1),
  cookTime: z.string().min(1),
  servings: z.number().int().positive(),
  featuredImage: z.string().url(),
  featured: z.boolean().optional(),
  ingredients: z.array(z.string()).min(1),
  instructions: z.array(z.string()).min(1),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  ogImage: z.string().url().nullable().optional(),
})

export async function GET(req: NextRequest) {
  try {
    await requirePermission('content:read')

    const { searchParams } = new URL(req.url)
    const page = Number(searchParams.get('page')) || 1
    const take = 50
    const skip = (page - 1) * take
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const difficulty = searchParams.get('difficulty') || ''
    const featured = searchParams.get('featured')

    const where: any = {}

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (category) where.category = category
    if (difficulty) where.difficulty = difficulty
    if (featured === 'true') where.featured = true
    if (featured === 'false') where.featured = false

    const [recipes, total] = await Promise.all([
      prisma.recipe.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.recipe.count({ where }),
    ])

    return ok({ recipes, total })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const data = recipeSchema.parse(body)

    const recipe = await prisma.recipe.create({ data })

    await logAudit({
      userId: user.id,
      action: 'CREATE',
      entityType: 'Recipe',
      entityId: recipe.id,
      changes: data,
    })

    return ok({ recipe }, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return fail('Recipe with this title or slug already exists', 409)
    }
    return fail(error.message, 400)
  }
}
