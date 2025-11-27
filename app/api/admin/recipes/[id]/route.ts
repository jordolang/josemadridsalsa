import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac'
import { ok, fail } from '@/lib/api'
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('content:read')
    const { id } = await params
    const recipe = await prisma.recipe.findUnique({ where: { id } })
    if (!recipe) return fail('Recipe not found', 404)
    return ok({ recipe })
  } catch (error: any) {
    return fail(error.message, error.status)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('content:write')
    const body = await req.json()
    const data = recipeSchema.partial().parse(body)
    const { id } = await params

    const existing = await prisma.recipe.findUnique({ where: { id } })
    if (!existing) return fail('Recipe not found', 404)

    const recipe = await prisma.recipe.update({
      where: { id },
      data,
    })

    await logAudit({
      userId: user.id,
      action: 'UPDATE',
      entityType: 'Recipe',
      entityId: recipe.id,
      changes: data,
    })

    return ok({ recipe })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return fail('Recipe with this title or slug already exists', 409)
    }
    return fail(error.message, 400)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission('content:write')
    const { id } = await params

    const existing = await prisma.recipe.findUnique({ where: { id } })
    if (!existing) return fail('Recipe not found', 404)

    await prisma.recipe.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: 'DELETE',
      entityType: 'Recipe',
      entityId: id,
      changes: { title: existing.title },
    })

    return ok({ message: 'Recipe deleted' })
  } catch (error: any) {
    return fail(error.message, 400)
  }
}
