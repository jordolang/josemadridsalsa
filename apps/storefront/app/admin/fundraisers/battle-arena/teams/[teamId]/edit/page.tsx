import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { prisma as db } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { TeamEditForm } from './_components/team-edit-form'
import {
  TeamProductCatalogEditor,
  type AdminProductOption,
  type AdminTeamProductRow,
} from './_components/team-product-catalog-editor'

interface Props {
  params: Promise<{ teamId: string }>
}

export default async function EditTeamPage({ params }: Props) {
  try {
    await requireAdminSession()
  } catch {
    redirect('/admin/login')
  }

  const { teamId } = await params
  const [team, teamProducts, allProducts] = await Promise.all([
    db.fundraiserTeam.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        slug: true,
        name: true,
        school: true,
        activePeriod: true,
        logoUrl: true,
        heroImageUrl: true,
        heroVideoUrl: true,
        campaignTitle: true,
        tagline: true,
        storyHtml: true,
      },
    }),
    db.fundraiserTeamProduct.findMany({
      where: { teamId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            isActive: true,
            featuredImage: true,
          },
        },
      },
    }),
    db.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        isActive: true,
      },
    }),
  ])
  if (!team) notFound()

  const serializedRows: AdminTeamProductRow[] = teamProducts.map((tp) => ({
    id: tp.id,
    productId: tp.productId,
    price: tp.price === null ? null : tp.price.toString(),
    sortOrder: tp.sortOrder,
    isActive: tp.isActive,
    product: {
      id: tp.product.id,
      name: tp.product.name,
      slug: tp.product.slug,
      price: tp.product.price.toString(),
      isActive: tp.product.isActive,
      featuredImage: tp.product.featuredImage,
    },
  }))
  const serializedProducts: AdminProductOption[] = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price.toString(),
    isActive: p.isActive,
  }))

  return (
    <div className="space-y-6">
      <Link
        href="/admin/fundraisers/battle-arena"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Battle Arena seasons
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit team</h1>
        <p className="text-muted-foreground">
          {team.name} <span className="font-mono text-xs">· {team.slug}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {team.school} · {team.activePeriod}
        </p>
      </div>
      <TeamEditForm team={team} />
      <TeamProductCatalogEditor
        teamId={team.id}
        initialRows={serializedRows}
        allProducts={serializedProducts}
      />
    </div>
  )
}
