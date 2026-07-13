import type { LogoBannerBlock as LogoBannerBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: LogoBannerBlockType
  fundraiser: {
    logoUrl: string | null
    organizationName: string
  }
}

export function LogoBannerBlock({ block, fundraiser }: Props) {
  const logoUrl = block.logoUrl || fundraiser.logoUrl
  const tagline = block.tagline || fundraiser.organizationName
  const bgColor = block.backgroundColor || '#f9fafb'

  return (
    <section
      className="flex flex-col items-center px-4 py-8 sm:flex-row sm:justify-center sm:gap-6"
      style={{ backgroundColor: bgColor }}
    >
      {logoUrl && (
        <div className="mb-4 h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-4 border-white shadow-md sm:mb-0 sm:h-24 sm:w-24">
          <img
            src={logoUrl}
            alt={fundraiser.organizationName}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="text-center sm:text-left">
        <h2 className="font-serif text-xl font-bold text-gray-900 sm:text-2xl">
          {tagline}
        </h2>
      </div>
    </section>
  )
}
