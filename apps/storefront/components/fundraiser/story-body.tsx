interface StoryBodyProps {
  html: string
  className?: string
}

export function StoryBody({ html, className }: StoryBodyProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
