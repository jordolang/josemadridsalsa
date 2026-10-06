import type { ImageTextBlock as ImageTextBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: ImageTextBlockType
}

export function ImageTextBlock({ block }: Props) {
  const { imageUrl, imagePosition, title, content, imageAlt } = block

  const imageEl = imageUrl ? (
    <img
      src={imageUrl}
      alt={imageAlt || title || ''}
      className="h-64 w-full rounded-xl object-cover"
    />
  ) : (
    <div className="flex h-64 w-full items-center justify-center rounded-xl bg-gray-100 text-gray-400">
      No image
    </div>
  )

  const textEl = (
    <div className="flex flex-col justify-center">
      {title && (
        <h2 className="mb-3 font-serif text-2xl font-bold text-gray-900">{title}</h2>
      )}
      <p className="leading-relaxed text-gray-600">{content}</p>
    </div>
  )

  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center">
          {imagePosition === 'left' ? (
            <>
              <div className="w-full md:w-1/2">{imageEl}</div>
              <div className="w-full md:w-1/2">{textEl}</div>
            </>
          ) : (
            <>
              <div className="w-full md:w-1/2 md:order-2">{imageEl}</div>
              <div className="w-full md:w-1/2 md:order-1">{textEl}</div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
