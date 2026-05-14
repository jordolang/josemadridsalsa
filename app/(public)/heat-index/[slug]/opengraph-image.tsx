import { ImageResponse } from 'next/og'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const alt = 'The Heat Index — Jose Madrid Salsa'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface OgParams {
  params: Promise<{ slug: string }>
}

export default async function OgImage({ params }: OgParams) {
  const { slug } = await params
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    select: {
      title: true,
      subtitle: true,
      excerpt: true,
      coverImage: true,
      category: { select: { name: true, accentColor: true } },
      series: { select: { name: true, accentColor: true } },
    },
  })

  const title = post?.title ?? 'The Heat Index'
  const subtitle = post?.subtitle ?? post?.excerpt ?? 'Jose Madrid Salsa magazine'
  const eyebrow =
    post?.series?.name ?? post?.category?.name ?? 'Jose Madrid Salsa Magazine'
  const accent = post?.series?.accentColor ?? post?.category?.accentColor ?? '#d53030'

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background:
            `linear-gradient(135deg, ${accent} 0%, #7f1d1d 50%, #1f1f1f 100%)`,
          color: '#fff',
          padding: '80px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '20px',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            fontWeight: 700,
            opacity: 0.9,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '999px',
              background: '#fff',
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            🔥
          </div>
          {eyebrow}
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            marginTop: '40px',
          }}
        >
          <div
            style={{
              fontSize: title.length > 60 ? '60px' : '78px',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                marginTop: '32px',
                fontSize: '28px',
                lineHeight: 1.3,
                fontStyle: 'italic',
                opacity: 0.85,
                maxWidth: '900px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          <div>The Heat Index</div>
          <div>JoseMadrid.net</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
