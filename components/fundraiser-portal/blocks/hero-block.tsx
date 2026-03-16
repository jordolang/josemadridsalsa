import type { HeroBlock as HeroBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: HeroBlockType
  fundraiser: {
    name: string
    organizationName: string
    coverPhotoUrl: string | null
    slug: string
  }
}

export function HeroBlock({ block, fundraiser }: Props) {
  const coverUrl = block.coverPhotoUrl || fundraiser.coverPhotoUrl
  const headline = block.headline || fundraiser.name
  const subheadline = block.subheadline || fundraiser.organizationName
  const ctaLabel = block.ctaLabel || 'Shop Now'

  return (
    <section className="relative overflow-hidden">
      {/* Background */}
      <div className="relative h-72 w-full bg-gradient-to-br from-salsa-600 to-salsa-800 sm:h-80 md:h-96">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={headline}
            className="absolute inset-0 h-full w-full object-cover opacity-60"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* Content overlay */}
        <div className="relative flex h-full flex-col items-center justify-center px-4 text-center text-white">
          <h1 className="mb-3 max-w-2xl font-serif text-3xl font-bold drop-shadow-lg sm:text-4xl md:text-5xl">
            {headline}
          </h1>
          <p className="mb-6 max-w-lg text-lg opacity-90 drop-shadow sm:text-xl">
            {subheadline}
          </p>
          <a
            href="#products"
            className="rounded-full bg-white px-8 py-3 font-semibold text-salsa-600 shadow-lg transition hover:bg-gray-100"
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </section>
  )
}
