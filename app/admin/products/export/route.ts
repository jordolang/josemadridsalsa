import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || (session.user as any).role !== 'ADMIN') {
    return new Response('Unauthorized', { status: 401 })
  }
  const where: any = {}
  const products = await prisma.product.findMany({ where, orderBy: { name: 'asc' } })

  const lines = [
    'id,name,sku,price,inventory,isActive,isFeatured,heatLevel,categoryId',
    ...products.map(p => [
      p.id,
      JSON.stringify(p.name),
      JSON.stringify(p.sku),
      String(p.price),
      String(p.inventory),
      String(p.isActive),
      String(p.isFeatured),
      p.heatLevel,
      p.categoryId,
    ].join(','))
  ]

  const body = lines.join('\n')
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="products.csv"'
    }
  })
}
