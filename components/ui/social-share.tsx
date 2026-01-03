'use client'

import { useEffect, useState } from 'react'
import { ShareButton } from './share-button'
import { SocialShareProps, SocialPlatform } from '@/types/sharing'
import { getAvailablePlatforms } from '@/lib/sharing/platforms'
import { cn } from '@/lib/utils'

export function SocialShare({
  content,
  platforms,
  orientation = 'horizontal',
  showLabels = false,
  size = 'md',
  title = 'Share',
  className,
}: SocialShareProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [availablePlatforms, setAvailablePlatforms] = useState<SocialPlatform[]>([])

  useEffect(() => {
    // Detect mobile device
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    // Get available platforms based on device and content type
    const platformList = platforms || getAvailablePlatforms(content.contentType, isMobile)
    setAvailablePlatforms(platformList)

    return () => window.removeEventListener('resize', checkMobile)
  }, [platforms, content.contentType, isMobile])

  if (availablePlatforms.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      )}

      <div
        className={cn(
          'flex gap-2',
          orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap'
        )}
      >
        {availablePlatforms.map((platform) => (
          <ShareButton
            key={platform}
            platform={platform}
            content={content}
            size={size}
            showLabel={showLabels}
          />
        ))}
      </div>
    </div>
  )
}
