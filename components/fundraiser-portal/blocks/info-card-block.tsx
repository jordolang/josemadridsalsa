import type { InfoCardBlock as InfoCardBlockType } from '@/lib/fundraiser-page-config'

const styleClasses: Record<InfoCardBlockType['style'], string> = {
  default: 'bg-gray-100 border-gray-200 text-gray-800',
  highlight: 'bg-salsa-50 border-salsa-200 text-salsa-900',
  warning: 'bg-amber-50 border-amber-300 text-amber-900',
  success: 'bg-green-50 border-green-300 text-green-900',
}

type Props = {
  block: InfoCardBlockType
}

export function InfoCardBlock({ block }: Props) {
  const { title, content, style, icon } = block
  const classes = styleClasses[style]

  return (
    <section className="px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <div className={`rounded-xl border p-5 ${classes}`}>
          {(icon || title) && (
            <div className="mb-2 flex items-center gap-2">
              {icon && <span className="text-xl">{icon}</span>}
              {title && <h3 className="font-semibold text-lg">{title}</h3>}
            </div>
          )}
          <p className="text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    </section>
  )
}
