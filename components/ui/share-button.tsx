'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShareButtonProps, SocialPlatform } from '@/types/sharing'
import { getPlatformConfig } from '@/lib/sharing/platforms'
import {
  generateShareUrl,
  openShareWindow,
  copyToClipboard,
  nativeShare,
} from '@/lib/sharing/url-generator'
import {
  trackShareEvent,
  trackShareSuccess,
  trackShareError,
  trackCopyToClipboard,
  trackNativeShare,
} from '@/lib/sharing/analytics'
import { cn } from '@/lib/utils'
import {
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  MessageCircle,
  Pin,
  Mail,
  Link,
  Share2,
  Check,
} from 'lucide-react'

const ICON_MAP: Record<SocialPlatform, any> = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  whatsapp: MessageCircle,
  pinterest: Pin,
  email: Mail,
  copy: Link,
  native: Share2,
}

export function ShareButton({
  platform,
  content,
  size = 'md',
  showLabel = false,
  className,
  onShare,
  onError,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const config = getPlatformConfig(platform)

  if (!config) return null

  const Icon = ICON_MAP[platform]
  const isCopyButton = platform === 'copy'
  const iconSize = size === 'sm' ? 14 : size === 'lg' ? 20 : 16

  const handleShare = async () => {
    setIsSharing(true)

    try {
      // Track share attempt
      trackShareEvent({
        platform,
        contentType: content.contentType,
        contentId: content.contentId,
        contentTitle: content.title,
      })

      // Handle platform-specific sharing
      if (platform === 'copy') {
        // Copy to clipboard
        const success = await copyToClipboard(content.url)
        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
          trackCopyToClipboard({
            contentType: content.contentType,
            contentId: content.contentId,
            url: content.url,
          })
          trackShareSuccess({ platform, contentType: content.contentType, contentId: content.contentId })
          onShare?.()
        } else {
          throw new Error('Failed to copy to clipboard')
        }
      } else if (platform === 'native') {
        // Use native share API
        const success = await nativeShare(content)
        if (success) {
          trackNativeShare({
            contentType: content.contentType,
            contentId: content.contentId,
          })
          trackShareSuccess({ platform, contentType: content.contentType, contentId: content.contentId })
          onShare?.()
        }
      } else if (platform === 'instagram') {
        // Instagram doesn't have direct share URL - copy link for posting
        const success = await copyToClipboard(content.url)
        if (success) {
          setCopied(true)
          setTimeout(() => setCopied(false), 3000)
          trackShareSuccess({ platform, contentType: content.contentType, contentId: content.contentId })
          onShare?.()
        } else {
          throw new Error('Failed to copy link for Instagram')
        }
      } else {
        // Generate and open share URL
        const shareUrl = generateShareUrl(platform, content)
        openShareWindow(shareUrl, platform)
        trackShareSuccess({ platform, contentType: content.contentType, contentId: content.contentId })
        onShare?.()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Share failed'
      trackShareError({
        platform,
        contentType: content.contentType,
        error: errorMessage,
        contentId: content.contentId,
      })
      onError?.(error as Error)
    } finally {
      setIsSharing(false)
    }
  }

  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'

  return (
    <Button
      variant="outline"
      size={buttonSize}
      onClick={handleShare}
      disabled={isSharing}
      className={cn(
        'gap-2 transition-all',
        !showLabel && 'w-9 h-9 p-0',
        className
      )}
      style={{
        borderColor: config.color,
        color: config.color,
      }}
      aria-label={`Share on ${config.label}`}
    >
      {copied && isCopyButton ? (
        <Check size={iconSize} className="text-green-600" />
      ) : (
        <Icon size={iconSize} />
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {copied && isCopyButton ? 'Copied!' : config.label}
        </span>
      )}
    </Button>
  )
}
