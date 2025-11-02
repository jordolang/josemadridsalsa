import type { SocialMediaPlatform } from '@prisma/client'

export type SocialComposerState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Partial<Record<'content' | 'platforms' | 'scheduledAt', string[]>>
}

export type SocialPlatformOption = {
  value: SocialMediaPlatform
  label: string
  description: string
  handle?: string
  isConnected?: boolean
  lastSyncedAt?: string | null
  connectUrl?: string
}
