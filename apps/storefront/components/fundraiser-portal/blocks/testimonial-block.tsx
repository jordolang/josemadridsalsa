import type { TestimonialBlock as TestimonialBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: TestimonialBlockType
}

export function TestimonialBlock({ block }: Props) {
  const { quote, author, role, avatarUrl } = block

  return (
    <section className="bg-gray-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="relative rounded-2xl bg-white p-8 shadow-sm">
          <span className="absolute left-6 top-4 text-6xl leading-none text-salsa-200 select-none">
            &ldquo;
          </span>
          <p className="relative z-10 mt-6 text-lg italic leading-relaxed text-gray-700">
            {quote}
          </p>
          {(author || avatarUrl) && (
            <div className="mt-6 flex items-center gap-4">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={author || 'Supporter'}
                  className="h-12 w-12 rounded-full object-cover"
                />
              )}
              <div>
                {author && (
                  <p className="font-semibold text-gray-900">{author}</p>
                )}
                {role && (
                  <p className="text-sm text-gray-500">{role}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
