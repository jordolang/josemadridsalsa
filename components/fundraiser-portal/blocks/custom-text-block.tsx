import type { CustomTextBlock as CustomTextBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: CustomTextBlockType
}

export function CustomTextBlock({ block }: Props) {
  const { content, alignment } = block

  if (!content) return null

  const alignClass =
    alignment === 'center'
      ? 'text-center'
      : alignment === 'right'
        ? 'text-right'
        : 'text-left'

  return (
    <section className="px-4 py-8">
      <div className={`mx-auto max-w-3xl ${alignClass}`}>
        <p className="whitespace-pre-line text-lg leading-relaxed text-gray-700">
          {content}
        </p>
      </div>
    </section>
  )
}
