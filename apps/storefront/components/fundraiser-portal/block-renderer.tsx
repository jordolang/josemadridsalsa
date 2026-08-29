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
import { StatCardsBlock } from './blocks/stat-cards-block'
import { InfoCardBlock } from './blocks/info-card-block'
import { CtaButtonBlock } from './blocks/cta-button-block'
import { VideoEmbedBlock } from './blocks/video-embed-block'
import { TestimonialBlock } from './blocks/testimonial-block'
import { ContactFormBlock } from './blocks/contact-form-block'
import { DividerBlock } from './blocks/divider-block'
import { ImageTextBlock } from './blocks/image-text-block'
import { CountdownBlock } from './blocks/countdown-block'
import { AnnouncementBannerBlock } from './blocks/announcement-banner-block'
import type { Prisma } from '@prisma/client'
import type { FundraiserStoreProduct } from '@/components/fundraiser/fundraiser-store'

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
  goal: Prisma.Decimal | number | string | null
  totalRevenue: Prisma.Decimal | number | string | null
  slug: string
  /** The group's share of merchandise, as a percentage. */
  commissionRate: number
  /** This campaign's shelf, at this campaign's prices — see `lib/fundraising/store.server.ts`. */
  storeProducts: FundraiserStoreProduct[]
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
      return (
<ProductShowcaseBlock block={block} fundraiser={fundraiser} />
      )
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
    case 'stat_cards':
      return <StatCardsBlock block={block} />
    case 'info_card':
      return <InfoCardBlock block={block} />
    case 'cta_button':
      return <CtaButtonBlock block={block} />
    case 'video_embed':
      return <VideoEmbedBlock block={block} />
    case 'testimonial':
      return <TestimonialBlock block={block} />
    case 'contact_form':
      return <ContactFormBlock block={block} />
    case 'divider':
      return <DividerBlock block={block} />
    case 'image_text':
      return <ImageTextBlock block={block} />
    case 'countdown':
      return <CountdownBlock block={block} />
    case 'announcement_banner':
      return <AnnouncementBannerBlock block={block} />
    default:
      return null
  }
}
