'use client'

import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'

/**
 * Styles for each Markdown element, sized for a chat bubble. Text colors
 * inherit from the bubble so replies read well on its muted background.
 */
const chatMarkdownComponents: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => {
    const isExternal = typeof href === 'string' && /^https?:\/\//i.test(href)
    return (
      <a
        href={href}
        className="font-medium text-salsa-600 underline underline-offset-2 hover:text-salsa-700"
        {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {children}
      </a>
    )
  },
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  h1: ({ children }) => <p className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</p>,
  h2: ({ children }) => <p className="mb-1 mt-3 text-base font-semibold first:mt-0">{children}</p>,
  h3: ({ children }) => <p className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>,
  h4: ({ children }) => <p className="mb-1 mt-3 font-semibold first:mt-0">{children}</p>,
  blockquote: ({ children }) => (
    <blockquote className="my-2 border-l-2 border-salsa-300 pl-3 italic">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-background/70 p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-2 py-1 align-top">{children}</td>,
}

/**
 * Renders a chat reply as Markdown (bold, italics, lists, links, headings,
 * tables, code) instead of showing the raw asterisks and pound signs.
 * Raw HTML in a reply is never rendered, and the output is sanitized.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={chatMarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
