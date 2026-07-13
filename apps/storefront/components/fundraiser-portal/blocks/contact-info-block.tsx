import type { ContactInfoBlock as ContactInfoBlockType } from '@/lib/fundraiser-page-config'

type Props = {
  block: ContactInfoBlockType
  fundraiser: {
    contactEmail: string
    contactPhone: string | null
    organizationName: string
  }
}

export function ContactInfoBlock({ block, fundraiser }: Props) {
  const { showEmail, showPhone, customMessage } = block

  if (!showEmail && !showPhone && !customMessage) return null

  return (
    <section className="bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="mb-4 font-serif text-2xl font-bold text-gray-900">
          Get in Touch
        </h2>
        {customMessage && (
          <p className="mb-4 text-gray-600">{customMessage}</p>
        )}
        <div className="space-y-2">
          {showEmail && (
            <p className="text-gray-700">
              <span className="mr-2 text-gray-500">Email:</span>
              <a
                href={`mailto:${fundraiser.contactEmail}`}
                className="text-salsa-600 hover:text-salsa-700"
              >
                {fundraiser.contactEmail}
              </a>
            </p>
          )}
          {showPhone && fundraiser.contactPhone && (
            <p className="text-gray-700">
              <span className="mr-2 text-gray-500">Phone:</span>
              <a
                href={`tel:${fundraiser.contactPhone}`}
                className="text-salsa-600 hover:text-salsa-700"
              >
                {fundraiser.contactPhone}
              </a>
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
