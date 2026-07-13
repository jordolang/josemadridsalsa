import type { CtaButtonBlock as CtaButtonBlockType } from '@/lib/fundraiser-page-config'

const styleClasses: Record<CtaButtonBlockType['style'], string> = {
  primary: 'bg-salsa-500 text-white hover:bg-salsa-600',
  secondary: 'bg-gray-800 text-white hover:bg-gray-900',
  outline: 'border-2 border-salsa-500 text-salsa-600 hover:bg-salsa-50',
}

const sizeClasses: Record<CtaButtonBlockType['size'], string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-6 py-3',
  lg: 'px-8 py-4 text-lg',
}

const alignClasses: Record<CtaButtonBlockType['alignment'], string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

type Props = {
  block: CtaButtonBlockType
}

export function CtaButtonBlock({ block }: Props) {
  const { label, url, style, size, alignment } = block

  return (
    <section className="px-4 py-6">
      <div className={`mx-auto max-w-3xl ${alignClasses[alignment]}`}>
        <a
          href={url}
          className={`inline-block rounded-lg font-semibold transition ${styleClasses[style]} ${sizeClasses[size]}`}
        >
          {label}
        </a>
      </div>
    </section>
  )
}
