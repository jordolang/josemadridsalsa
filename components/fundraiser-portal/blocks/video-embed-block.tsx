import type { VideoEmbedBlock as VideoEmbedBlockType } from '@/lib/fundraiser-page-config'

function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    // Handle youtu.be short links
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.slice(1)
      return `https://www.youtube.com/embed/${videoId}`
    }
    // Handle youtube.com/watch?v=
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v')
      if (videoId) return `https://www.youtube.com/embed/${videoId}`
    }
  } catch {
    // Not a valid URL
  }
  return null
}

type Props = {
  block: VideoEmbedBlockType
}

export function VideoEmbedBlock({ block }: Props) {
  const { youtubeUrl, title, aspectRatio } = block
  const paddingBottom = aspectRatio === '4:3' ? '75%' : '56.25%'
  const embedUrl = youtubeUrl ? toEmbedUrl(youtubeUrl) : null

  return (
    <section className="px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {title && (
          <h2 className="mb-4 text-center font-serif text-2xl font-bold text-gray-900">
            {title}
          </h2>
        )}
        {embedUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl shadow-md" style={{ paddingBottom }}>
            <iframe
              src={embedUrl}
              title={title || 'Video'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        ) : (
          <div
            className="flex items-center justify-center rounded-xl bg-gray-100 text-gray-400"
            style={{ paddingBottom, position: 'relative' }}
          >
            <span className="absolute">No video configured</span>
          </div>
        )}
      </div>
    </section>
  )
}
