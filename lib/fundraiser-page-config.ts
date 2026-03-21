import { z } from 'zod'

// ── Block type definitions ──

export type BlockType =
  | 'hero'
  | 'logo_banner'
  | 'mission_statement'
  | 'progress_bar'
  | 'product_showcase'
  | 'participant_leaderboard'
  | 'gallery'
  | 'custom_text'
  | 'contact_info'
  | 'how_it_works'
  | 'stat_cards'
  | 'info_card'
  | 'cta_button'
  | 'video_embed'
  | 'testimonial'
  | 'contact_form'
  | 'divider'
  | 'image_text'
  | 'countdown'
  | 'announcement_banner'

export interface HeroBlock {
  type: 'hero'
  coverPhotoUrl?: string
  headline?: string
  subheadline?: string
  ctaLabel?: string
}

export interface LogoBannerBlock {
  type: 'logo_banner'
  logoUrl?: string
  tagline?: string
  backgroundColor?: string
}

export interface MissionStatementBlock {
  type: 'mission_statement'
  text?: string
  showGoalProgress: boolean
}

export interface ProgressBarBlock {
  type: 'progress_bar'
  showAmount: boolean
  showPercentage: boolean
  label?: string
}

export interface ProductShowcaseBlock {
  type: 'product_showcase'
  pricePoints: number[]
  title?: string
  columns: 2 | 3 | 4
}

export interface ParticipantLeaderboardBlock {
  type: 'participant_leaderboard'
  topN: number
  title?: string
}

export interface GalleryBlock {
  type: 'gallery'
  imageUrls: string[]
  columns: 2 | 3
  title?: string
}

export interface CustomTextBlock {
  type: 'custom_text'
  content: string
  alignment: 'left' | 'center' | 'right'
}

export interface ContactInfoBlock {
  type: 'contact_info'
  showEmail: boolean
  showPhone: boolean
  customMessage?: string
}

export interface HowItWorksBlock {
  type: 'how_it_works'
  steps?: Array<{ title: string; description: string }>
}

export interface StatCardsBlock {
  type: 'stat_cards'
  title?: string
  cards: Array<{ label: string; value: string; icon?: 'heart' | 'star' | 'fire' | 'trophy' | 'dollar' | 'people' }>
  columns: 2 | 3 | 4
}

export interface InfoCardBlock {
  type: 'info_card'
  title?: string
  content: string
  style: 'default' | 'highlight' | 'warning' | 'success'
  icon?: string
  backgroundColor?: string
}

export interface CtaButtonBlock {
  type: 'cta_button'
  label: string
  url: string
  style: 'primary' | 'secondary' | 'outline'
  size: 'sm' | 'md' | 'lg'
  alignment: 'left' | 'center' | 'right'
}

export interface VideoEmbedBlock {
  type: 'video_embed'
  youtubeUrl?: string
  title?: string
  aspectRatio: '16:9' | '4:3'
}

export interface TestimonialBlock {
  type: 'testimonial'
  quote: string
  author?: string
  role?: string
  avatarUrl?: string
}

export interface ContactFormBlock {
  type: 'contact_form'
  title?: string
  recipientEmail?: string
  fields: Array<'name' | 'email' | 'phone' | 'message' | 'organization'>
  submitLabel?: string
}

export interface DividerBlock {
  type: 'divider'
  style: 'line' | 'dots' | 'wave' | 'salsa'
  color?: string
  spacing: 'sm' | 'md' | 'lg'
}

export interface ImageTextBlock {
  type: 'image_text'
  imageUrl?: string
  imagePosition: 'left' | 'right'
  title?: string
  content: string
  imageAlt?: string
}

export interface CountdownBlock {
  type: 'countdown'
  targetDate: string
  title?: string
  expiredMessage?: string
}

export interface AnnouncementBannerBlock {
  type: 'announcement_banner'
  message: string
  style: 'info' | 'success' | 'warning' | 'urgent'
  dismissible: boolean
}

export type PageBlock =
  | HeroBlock
  | LogoBannerBlock
  | MissionStatementBlock
  | ProgressBarBlock
  | ProductShowcaseBlock
  | ParticipantLeaderboardBlock
  | GalleryBlock
  | CustomTextBlock
  | ContactInfoBlock
  | HowItWorksBlock
  | StatCardsBlock
  | InfoCardBlock
  | CtaButtonBlock
  | VideoEmbedBlock
  | TestimonialBlock
  | ContactFormBlock
  | DividerBlock
  | ImageTextBlock
  | CountdownBlock
  | AnnouncementBannerBlock

export interface FundraiserPageConfig {
  version: 1
  theme: 'default' | 'minimal' | 'bold'
  blocks: PageBlock[]
}

// ── Default page config (Facebook profile-style layout) ──

export const defaultPageConfig: FundraiserPageConfig = {
  version: 1,
  theme: 'default',
  blocks: [
    { type: 'hero', ctaLabel: 'Shop & Support' },
    { type: 'logo_banner' },
    { type: 'mission_statement', showGoalProgress: true },
    { type: 'progress_bar', showAmount: true, showPercentage: true },
    { type: 'product_showcase', pricePoints: [25, 50], title: 'Support Our Cause', columns: 3 },
    { type: 'participant_leaderboard', topN: 5, title: 'Top Supporters' },
    { type: 'how_it_works', steps: [
      { title: 'Choose Your Salsa', description: 'Browse our selection of handcrafted salsas and bundles.' },
      { title: 'Place Your Order', description: 'Order online and your purchase supports our fundraiser.' },
      { title: 'We Earn Commission', description: 'A portion of every sale goes directly to our cause.' },
    ] },
    { type: 'contact_info', showEmail: true, showPhone: true },
  ],
}

// ── Block metadata for the editor UI ──

export const blockTypeLabels: Record<BlockType, string> = {
  hero: 'Hero Banner',
  logo_banner: 'Logo & Tagline',
  mission_statement: 'Mission Statement',
  progress_bar: 'Progress Bar',
  product_showcase: 'Product Showcase',
  participant_leaderboard: 'Leaderboard',
  gallery: 'Photo Gallery',
  custom_text: 'Custom Text',
  contact_info: 'Contact Info',
  how_it_works: 'How It Works',
  stat_cards: 'Stat Cards',
  info_card: 'Info Card',
  cta_button: 'CTA Button',
  video_embed: 'Video Embed',
  testimonial: 'Testimonial',
  contact_form: 'Contact Form',
  divider: 'Section Divider',
  image_text: 'Image + Text',
  countdown: 'Countdown Timer',
  announcement_banner: 'Announcement Banner',
}

export const blockTypeDescriptions: Record<BlockType, string> = {
  hero: 'Full-width cover photo with headline and call-to-action button',
  logo_banner: 'Display your organization logo with a tagline',
  mission_statement: 'Share your cause and optionally show goal progress',
  progress_bar: 'Visual fundraising progress toward your goal',
  product_showcase: 'Display products at specific price points for easy ordering',
  participant_leaderboard: 'Show top fundraising participants',
  gallery: 'Display a grid of photos from your organization',
  custom_text: 'Add any custom text content to your page',
  contact_info: 'Display contact information for your organization',
  how_it_works: 'Step-by-step guide explaining how the fundraiser works',
  stat_cards: 'Highlight key metrics in a grid of visually distinct stat cards',
  info_card: 'A callout card for important information, tips, or announcements',
  cta_button: 'A prominent call-to-action button that links to any URL',
  video_embed: 'Embed a YouTube video to showcase your fundraiser story',
  testimonial: 'Display a quote or testimonial from a supporter or community member',
  contact_form: 'A contact form visitors can fill out to reach the fundraiser organizer',
  divider: 'A visual separator to break up sections of your page',
  image_text: 'Side-by-side image and text layout for storytelling and photos',
  countdown: 'A live countdown timer showing time remaining until a key date',
  announcement_banner: 'A full-width banner to broadcast urgent updates or announcements',
}

// ── Zod validation ──

const heroBlockSchema = z.object({
  type: z.literal('hero'),
  coverPhotoUrl: z.string().url().optional(),
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(500).optional(),
  ctaLabel: z.string().max(50).optional(),
})

const logoBannerBlockSchema = z.object({
  type: z.literal('logo_banner'),
  logoUrl: z.string().url().optional(),
  tagline: z.string().max(200).optional(),
  backgroundColor: z.string().max(20).optional(),
})

const missionStatementBlockSchema = z.object({
  type: z.literal('mission_statement'),
  text: z.string().max(2000).optional(),
  showGoalProgress: z.boolean(),
})

const progressBarBlockSchema = z.object({
  type: z.literal('progress_bar'),
  showAmount: z.boolean(),
  showPercentage: z.boolean(),
  label: z.string().max(100).optional(),
})

const productShowcaseBlockSchema = z.object({
  type: z.literal('product_showcase'),
  pricePoints: z.array(z.number().positive()).min(1).max(10),
  title: z.string().max(200).optional(),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
})

const participantLeaderboardBlockSchema = z.object({
  type: z.literal('participant_leaderboard'),
  topN: z.number().int().min(1).max(50),
  title: z.string().max(200).optional(),
})

const galleryBlockSchema = z.object({
  type: z.literal('gallery'),
  imageUrls: z.array(z.string().url()).max(20),
  columns: z.union([z.literal(2), z.literal(3)]),
  title: z.string().max(200).optional(),
})

const customTextBlockSchema = z.object({
  type: z.literal('custom_text'),
  content: z.string().max(5000),
  alignment: z.enum(['left', 'center', 'right']),
})

const contactInfoBlockSchema = z.object({
  type: z.literal('contact_info'),
  showEmail: z.boolean(),
  showPhone: z.boolean(),
  customMessage: z.string().max(500).optional(),
})

const howItWorksBlockSchema = z.object({
  type: z.literal('how_it_works'),
  steps: z
    .array(
      z.object({
        title: z.string().max(100),
        description: z.string().max(500),
      })
    )
    .max(10)
    .optional(),
})

const statCardsBlockSchema = z.object({
  type: z.literal('stat_cards'),
  title: z.string().max(200).optional(),
  cards: z.array(
    z.object({
      label: z.string().max(100),
      value: z.string().max(100),
      icon: z.enum(['heart', 'star', 'fire', 'trophy', 'dollar', 'people']).optional(),
    })
  ).max(8),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
})

const infoCardBlockSchema = z.object({
  type: z.literal('info_card'),
  title: z.string().max(200).optional(),
  content: z.string().max(2000),
  style: z.enum(['default', 'highlight', 'warning', 'success']),
  icon: z.string().max(10).optional(),
  backgroundColor: z.string().max(20).optional(),
})

const ctaButtonBlockSchema = z.object({
  type: z.literal('cta_button'),
  label: z.string().max(100),
  url: z.string().max(500),
  style: z.enum(['primary', 'secondary', 'outline']),
  size: z.enum(['sm', 'md', 'lg']),
  alignment: z.enum(['left', 'center', 'right']),
})

const videoEmbedBlockSchema = z.object({
  type: z.literal('video_embed'),
  youtubeUrl: z.string().max(500).optional(),
  title: z.string().max(200).optional(),
  aspectRatio: z.enum(['16:9', '4:3']),
})

const testimonialBlockSchema = z.object({
  type: z.literal('testimonial'),
  quote: z.string().max(2000),
  author: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  avatarUrl: z.string().url().optional(),
})

const contactFormBlockSchema = z.object({
  type: z.literal('contact_form'),
  title: z.string().max(200).optional(),
  recipientEmail: z.string().email().optional(),
  fields: z.array(z.enum(['name', 'email', 'phone', 'message', 'organization'])).min(1).max(5),
  submitLabel: z.string().max(50).optional(),
})

const dividerBlockSchema = z.object({
  type: z.literal('divider'),
  style: z.enum(['line', 'dots', 'wave', 'salsa']),
  color: z.string().max(20).optional(),
  spacing: z.enum(['sm', 'md', 'lg']),
})

const imageTextBlockSchema = z.object({
  type: z.literal('image_text'),
  imageUrl: z.string().url().optional(),
  imagePosition: z.enum(['left', 'right']),
  title: z.string().max(200).optional(),
  content: z.string().max(3000),
  imageAlt: z.string().max(200).optional(),
})

const countdownBlockSchema = z.object({
  type: z.literal('countdown'),
  targetDate: z.string().max(30),
  title: z.string().max(200).optional(),
  expiredMessage: z.string().max(200).optional(),
})

const announcementBannerBlockSchema = z.object({
  type: z.literal('announcement_banner'),
  message: z.string().max(500),
  style: z.enum(['info', 'success', 'warning', 'urgent']),
  dismissible: z.boolean(),
})

const pageBlockSchema = z.discriminatedUnion('type', [
  heroBlockSchema,
  logoBannerBlockSchema,
  missionStatementBlockSchema,
  progressBarBlockSchema,
  productShowcaseBlockSchema,
  participantLeaderboardBlockSchema,
  galleryBlockSchema,
  customTextBlockSchema,
  contactInfoBlockSchema,
  howItWorksBlockSchema,
  statCardsBlockSchema,
  infoCardBlockSchema,
  ctaButtonBlockSchema,
  videoEmbedBlockSchema,
  testimonialBlockSchema,
  contactFormBlockSchema,
  dividerBlockSchema,
  imageTextBlockSchema,
  countdownBlockSchema,
  announcementBannerBlockSchema,
])

export const fundraiserPageConfigSchema = z.object({
  version: z.literal(1),
  theme: z.enum(['default', 'minimal', 'bold']),
  blocks: z.array(pageBlockSchema).max(30),
})

export function validatePageConfig(
  config: unknown
): { success: true; data: FundraiserPageConfig } | { success: false; error: string } {
  const result = fundraiserPageConfigSchema.safeParse(config)
  if (result.success) {
    return { success: true, data: result.data as FundraiserPageConfig }
  }
  return { success: false, error: result.error.message }
}
