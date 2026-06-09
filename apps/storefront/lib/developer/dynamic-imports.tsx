import dynamic from 'next/dynamic'

/**
 * Dynamically imported developer page components.
 * Framer Motion is ~30-40 KB gzipped — keep it out of the initial bundle
 * by code-splitting all animation-heavy sections behind next/dynamic.
 *
 * Each import uses a skeleton loader sized to prevent CLS (Cumulative Layout Shift).
 */

export const DeveloperScrollSection = dynamic(
  () =>
    import('@/components/developer/developer-scroll-section').then((mod) => ({
      default: mod.DeveloperScrollSection,
    })),
  {
    ssr: true,
    loading: () => null,
  }
)

export const DeveloperTimeline = dynamic(
  () =>
    import('@/components/developer/developer-timeline').then((mod) => ({
      default: mod.DeveloperTimeline,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-lg bg-muted" />
    ),
  }
)

export const DeveloperSkills = dynamic(
  () =>
    import('@/components/developer/developer-skills').then((mod) => ({
      default: mod.DeveloperSkills,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-80 animate-pulse rounded-lg bg-muted" />
    ),
  }
)

export const DeveloperContactForm = dynamic(
  () =>
    import('@/components/developer/developer-contact-form').then((mod) => ({
      default: mod.DeveloperContactForm,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    ),
  }
)

export const DeveloperBlogPreview = dynamic(
  () =>
    import('@/components/developer/developer-blog-preview').then((mod) => ({
      default: mod.DeveloperBlogPreview,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    ),
  }
)

export const DeveloperBlogContent = dynamic(
  () =>
    import('@/components/developer/developer-blog-content').then((mod) => ({
      default: mod.DeveloperBlogContent,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="h-96 animate-pulse rounded-lg bg-muted" />
    ),
  }
)
