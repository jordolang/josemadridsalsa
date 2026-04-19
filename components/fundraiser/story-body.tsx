interface StoryBodyProps {
  html: string
  className?: string
}

export function StoryBody({ html, className }: StoryBodyProps) {
  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
