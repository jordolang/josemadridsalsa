'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

interface BlogContentProps {
  content: string
}

export function BlogContent({ content }: BlogContentProps) {
  return (
    <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-a:text-salsa-600 hover:prose-a:text-salsa-700 prose-img:rounded-2xl prose-img:shadow-md prose-blockquote:border-l-salsa-500 prose-blockquote:not-italic prose-blockquote:font-medium prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-hr:border-salsa-100">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </div>
  )
}
