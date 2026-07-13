'use client'

import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

interface DeveloperBlogContentProps {
  content: string
}

export function DeveloperBlogContent({ content }: DeveloperBlogContentProps) {
  return (
    <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none prose-headings:font-serif prose-headings:font-bold prose-a:text-salsa-600 hover:prose-a:text-salsa-700 prose-img:rounded-xl prose-pre:bg-muted prose-pre:border prose-pre:border-border">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
