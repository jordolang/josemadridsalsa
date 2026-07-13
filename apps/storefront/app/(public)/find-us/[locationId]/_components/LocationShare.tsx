'use client'

import { SocialShare } from '@/components/ui/social-share'
import { ShareContent } from '@/types/sharing'
import { generateHashtags } from '@/lib/sharing/metadata-extractor'

interface LocationShareProps {
  location: {
    id: string
    businessName: string
    city: string
    state: string
    address: string
    photoUrl: string | null
  }
}

export function LocationShare({ location }: LocationShareProps) {
  const shareContent: ShareContent = {
    title: `${location.businessName} - Find Jose Madrid Salsa`,
    description: `Get Jose Madrid Salsa at ${location.businessName} in ${location.city}, ${location.state}`,
    url: typeof window !== 'undefined' ? window.location.href : '',
    image: location.photoUrl || undefined,
    contentType: 'location',
    contentId: location.id,
    hashtags: generateHashtags('location'),
    via: 'josemadridsalsa',
  }

  return (
    <div className="border-t border-slate-100 pt-6">
      <SocialShare
        content={shareContent}
        size="md"
        title="Share this location"
        showLabels={false}
      />
    </div>
  )
}
