import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import {
  type FundraiserPageConfig,
  defaultPageConfig,
  validatePageConfig,
} from '@/lib/fundraiser-page-config'
import { BlockRenderer } from '@/components/fundraiser-portal/block-renderer'
import type { Metadata } from 'next'

type Props = {
  params: Promise<{ subdomain: string }>
}

async function getFundraiserBySubdomain(subdomain: string) {
  const fundraiser = await prisma.fundraiser.findUnique({
    where: { subdomain },
    include: {
      products: {
        where: { isActive: true },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              price: true,
              images: true,
            },
          },
        },
      },
      participants: {
        where: { status: 'ACTIVE' },
        orderBy: { totalRevenue: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          totalOrders: true,
          totalRevenue: true,
          referralCode: true,
        },
      },
    },
  })

  return fundraiser
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params
  const fundraiser = await getFundraiserBySubdomain(subdomain)

  if (!fundraiser) {
    return { title: 'Fundraiser Not Found' }
  }

  return {
    title: `${fundraiser.name} | Jose Madrid Salsa Fundraiser`,
    description:
      fundraiser.missionStatement ||
      fundraiser.description ||
      `Support ${fundraiser.organizationName} by purchasing delicious handcrafted salsa.`,
    openGraph: {
      title: fundraiser.name,
      description:
        fundraiser.missionStatement ||
        fundraiser.description ||
        `Support ${fundraiser.organizationName}`,
      images: fundraiser.coverPhotoUrl ? [fundraiser.coverPhotoUrl] : [],
    },
  }
}

export default async function FundraiserSubdomainPage({ params }: Props) {
  const { subdomain } = await params
  const fundraiser = await getFundraiserBySubdomain(subdomain)

  if (!fundraiser) {
    notFound()
  }

  // Show ended page if fundraiser is inactive
  if (!fundraiser.isActive || fundraiser.status === 'ENDED' || fundraiser.status === 'CANCELLED') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          {fundraiser.logoUrl && (
            <img
              src={fundraiser.logoUrl}
              alt={fundraiser.organizationName}
              className="mx-auto mb-6 h-24 w-24 rounded-full object-cover"
            />
          )}
          <h1 className="mb-4 font-serif text-3xl font-bold text-gray-900">
            {fundraiser.name}
          </h1>
          <p className="mb-2 text-lg text-gray-600">
            This fundraiser has ended.
          </p>
          <p className="text-sm text-gray-500">
            Thank you to everyone who supported {fundraiser.organizationName}!
          </p>
        </div>
      </div>
    )
  }

  // Parse page config or use default
  let pageConfig: FundraiserPageConfig = defaultPageConfig

  if (fundraiser.pageConfig) {
    try {
      const validated = validatePageConfig(fundraiser.pageConfig)
      if (validated) {
        pageConfig = validated
      }
    } catch {
      pageConfig = defaultPageConfig
    }
  }

  return (
    <div className="min-h-screen">
      {pageConfig.blocks.map((block, index) => (
        <BlockRenderer
          key={`${block.type}-${index}`}
          block={block}
          fundraiser={fundraiser}
        />
      ))}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
        <p>
          Powered by{' '}
          <a
            href="https://josemadridsalsa.com"
            className="text-salsa-600 hover:text-salsa-700"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jose Madrid Salsa
          </a>
        </p>
      </footer>
    </div>
  )
}
