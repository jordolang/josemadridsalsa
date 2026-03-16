import type { PageBlock } from '@/lib/fundraiser-page-config'
import { HeroBlock } from './blocks/hero-block'
import { LogoBannerBlock } from './blocks/logo-banner-block'
import { MissionStatementBlock } from './blocks/mission-statement-block'
import { ProgressBarBlock } from './blocks/progress-bar-block'
import { ProductShowcaseBlock } from './blocks/product-showcase-block'
import { LeaderboardBlock } from './blocks/leaderboard-block'
import { GalleryBlock } from './blocks/gallery-block'
import { CustomTextBlock } from './blocks/custom-text-block'
import { ContactInfoBlock } from './blocks/contact-info-block'
import { HowItWorksBlock } from './blocks/how-it-works-block'
import type { Prisma } from '@prisma/client'

type FundraiserData = {
  name: string
  organizationName: string
  description: string | null
  missionStatement: string | null
  bio: string | null
  logoUrl: string | null
  coverPhotoUrl: string | null
  contactEmail: string
  contactPhone: string | null
  goal: Prisma.Decimal | number | string
  totalRevenue: Prisma.Decimal | number | string
  slug: string
  products: Array<{
    price: Prisma.Decimal | number | string
    product: {
      id: string
      name: string
      slug: string
      description: string | null
      price: Prisma.Decimal | number | string
      images: string[]
    }
  }>
  participants: Array<{
    id: string
    name: string
    totalOrders: number
    totalRevenue: Prisma.Decimal | number | string
    referralCode: string
  }>
}

type BlockRendererProps = {
  block: PageBlock
  fundraiser: FundraiserData
}

export function BlockRenderer({ block, fundraiser }: BlockRendererProps) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} fundraiser={fundraiser} />
    case 'logo_banner':
      return <LogoBannerBlock block={block} fundraiser={fundraiser} />
    case 'mission_statement':
      return <MissionStatementBlock block={block} fundraiser={fundraiser} />
    case 'progress_bar':
      return <ProgressBarBlock block={block} fundraiser={fundraiser} />
    case 'product_showcase':
      return <ProductShowcaseBlock block={block} fundraiser={fundraiser} />
    case 'participant_leaderboard':
      return <LeaderboardBlock block={block} fundraiser={fundraiser} />
    case 'gallery':
      return <GalleryBlock block={block} />
    case 'custom_text':
      return <CustomTextBlock block={block} />
    case 'contact_info':
      return <ContactInfoBlock block={block} fundraiser={fundraiser} />
    case 'how_it_works':
      return <HowItWorksBlock block={block} />
    default:
      return null
  }
}
