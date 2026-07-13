import type { GalleryBlock as GalleryBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: GalleryBlockType
}

export function GalleryBlock({ block }: Props) {
  const title = block.title || 'Gallery'
  const { imageUrls, columns } = block

  if (imageUrls.length === 0) return null

  const gridCols = columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 md:grid-cols-3'

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 text-center font-serif text-2xl font-bold text-gray-900">
          {title}
        </h2>
        <div className={`grid grid-cols-1 gap-4 ${gridCols}`}>
          {imageUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={url}
                alt={`${title} photo ${index + 1}`}
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
