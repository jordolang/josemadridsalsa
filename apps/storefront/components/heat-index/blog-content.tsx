'use client'

import { Fragment } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

interface BlogContentProps {
  content: string
}

const SHORTCODE_RE = /\[\[(youtube|vimeo|video):([^\]]+)\]\]/g

interface Embed {
  kind: 'youtube' | 'vimeo' | 'video'
  value: string
}

interface MarkdownChunk {
  type: 'md'
  text: string
}

interface EmbedChunk {
  type: 'embed'
  embed: Embed
}

type Chunk = MarkdownChunk | EmbedChunk

function parseChunks(content: string): Chunk[] {
  const chunks: Chunk[] = []
  let cursor = 0
  for (const match of content.matchAll(SHORTCODE_RE)) {
    const start = match.index ?? 0
    if (start > cursor) {
      chunks.push({ type: 'md', text: content.slice(cursor, start) })
    }
    chunks.push({
      type: 'embed',
      embed: { kind: match[1] as Embed['kind'], value: match[2].trim() },
    })
    cursor = start + match[0].length
  }
  if (cursor < content.length) {
    chunks.push({ type: 'md', text: content.slice(cursor) })
  }
  return chunks
}

function YouTubeEmbed({ id }: { id: string }) {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20)
  return (
    <div className="relative my-8 aspect-video overflow-hidden rounded-2xl shadow-md not-prose">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${cleaned}`}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  )
}

function VimeoEmbed({ id }: { id: string }) {
  const cleaned = id.replace(/[^0-9]/g, '').slice(0, 12)
  return (
    <div className="relative my-8 aspect-video overflow-hidden rounded-2xl shadow-md not-prose">
      <iframe
        src={`https://player.vimeo.com/video/${cleaned}`}
        title="Vimeo video"
        loading="lazy"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  )
}

function isSafeMediaUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

function VideoEmbed({ url }: { url: string }) {
  if (!isSafeMediaUrl(url)) return null
  return (
    <div className="relative my-8 not-prose">
      <video
        controls
        preload="metadata"
        playsInline
        className="w-full rounded-2xl shadow-md bg-black"
      >
        <source src={url} />
        Your browser does not support embedded video.
      </video>
    </div>
  )
}

export function BlogContent({ content }: BlogContentProps) {
  const chunks = parseChunks(content)

  return (
    <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-a:text-salsa-600 hover:prose-a:text-salsa-700 prose-img:rounded-2xl prose-img:shadow-md prose-blockquote:border-l-salsa-500 prose-blockquote:not-italic prose-blockquote:font-medium prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-hr:border-salsa-100">
      {chunks.map((chunk, i) => {
        if (chunk.type === 'md') {
          return (
            <ReactMarkdown key={i} rehypePlugins={[rehypeSanitize]}>
              {chunk.text}
            </ReactMarkdown>
          )
        }
        const { embed } = chunk
        return (
          <Fragment key={i}>
            {embed.kind === 'youtube' && <YouTubeEmbed id={embed.value} />}
            {embed.kind === 'vimeo' && <VimeoEmbed id={embed.value} />}
            {embed.kind === 'video' && <VideoEmbed url={embed.value} />}
          </Fragment>
        )
      })}
    </div>
  )
}
