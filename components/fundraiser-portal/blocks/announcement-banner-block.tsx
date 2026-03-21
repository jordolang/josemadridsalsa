'use client'

import { useState } from 'react'
import type { AnnouncementBannerBlock as AnnouncementBannerBlockType } from '@/lib/fundraiser-page-config'

const styleClasses: Record<AnnouncementBannerBlockType['style'], string> = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  urgent: 'bg-red-50 border-red-300 text-red-900 font-semibold',
}

type Props = {
  block: AnnouncementBannerBlockType
}

export function AnnouncementBannerBlock({ block }: Props) {
  const { message, style, dismissible } = block
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className={`w-full border-b px-4 py-3 ${styleClasses[style]}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <p className="text-sm">{message}</p>
        {dismissible && (
          <button
            onClick={() => setDismissed(true)}
            className="ml-auto flex-shrink-0 rounded p-1 opacity-70 hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
