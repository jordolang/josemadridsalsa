'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  Facebook,
  Instagram,
  Twitter,
  Music2,
  Store,
  CalendarDays,
  Loader2,
  ImagePlus,
  Hash,
  Link2,
  Eye,
  Send,
  Save,
  Clock,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import type { SocialMediaPlatform } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { SocialComposerState, SocialAccountInfo } from '@/types/social'
import { PLATFORM_CONFIGS } from '@/types/social'

const PLATFORM_ICONS: Record<SocialMediaPlatform, React.ElementType> = {
  FACEBOOK: Facebook,
  INSTAGRAM: Instagram,
  TWITTER: Twitter,
  TIKTOK: Music2,
  GOOGLE_MY_BUSINESS: Store,
}

const PLATFORM_COLORS: Record<SocialMediaPlatform, string> = {
  FACEBOOK: 'border-blue-400 bg-blue-50 text-blue-700',
  INSTAGRAM: 'border-pink-400 bg-pink-50 text-pink-700',
  TWITTER: 'border-slate-400 bg-slate-50 text-slate-800',
  TIKTOK: 'border-slate-400 bg-slate-50 text-slate-800',
  GOOGLE_MY_BUSINESS: 'border-blue-300 bg-blue-50 text-blue-600',
}

type Props = {
  action: (state: SocialComposerState, formData: FormData) => Promise<SocialComposerState>
  accounts: SocialAccountInfo[]
  canSchedule: boolean
  canPublish: boolean
}

const INITIAL_STATE: SocialComposerState = { status: 'idle' }

export function SocialComposer({ action, accounts, canSchedule, canPublish }: Props) {
  const [state, formAction] = useActionState(action, INITIAL_STATE)
  const [content, setContent] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<SocialMediaPlatform>>(new Set())
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [hashtags, setHashtags] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [activePreviewPlatform, setActivePreviewPlatform] = useState<SocialMediaPlatform>('FACEBOOK')

  // Platform-specific content overrides
  const [platformOverrides, setPlatformOverrides] = useState<Partial<Record<SocialMediaPlatform, string>>>({})
  const [showOverrides, setShowOverrides] = useState(false)

  const connectedPlatforms = useMemo(
    () => new Set(accounts.map((a) => a.platform)),
    [accounts],
  )

  useEffect(() => {
    if (state.status === 'success') {
      setContent('')
      setSelectedPlatforms(new Set())
      setScheduleEnabled(false)
      setHashtags('')
      setLinkUrl('')
      setPlatformOverrides({})
      setShowOverrides(false)
    }
  }, [state])

  const togglePlatform = (platform: SocialMediaPlatform) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev)
      if (next.has(platform)) next.delete(platform)
      else next.add(platform)
      return next
    })
  }

  const getContentForPlatform = (platform: SocialMediaPlatform) => {
    return platformOverrides[platform] || content
  }

  const getCharCount = (platform: SocialMediaPlatform) => {
    const text = getContentForPlatform(platform)
    const hashtagText = hashtags ? '\n\n' + hashtags.split(',').map((h) => h.trim()).filter(Boolean).map((h) => h.startsWith('#') ? h : `#${h}`).join(' ') : ''
    return text.length + hashtagText.length
  }

  const charWarnings = useMemo(() => {
    const warnings: Partial<Record<SocialMediaPlatform, { count: number; max: number; over: boolean }>> = {}
    for (const platform of selectedPlatforms) {
      const config = PLATFORM_CONFIGS[platform]
      const count = getCharCount(platform)
      warnings[platform] = { count, max: config.maxChars, over: count > config.maxChars }
    }
    return warnings
  }, [content, selectedPlatforms, hashtags, platformOverrides])

  const hasOverLimit = Object.values(charWarnings).some((w) => w?.over)

  return (
    <div className="space-y-6">
      {state.status === 'success' && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {state.message}
        </div>
      )}
      {state.status === 'error' && state.message && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {state.message}
        </div>
      )}

      <form action={formAction} className="space-y-6">
        {/* Hidden fields for platform overrides */}
        {Object.entries(platformOverrides).map(([platform, value]) => (
          <input key={platform} type="hidden" name={`${platform.toLowerCase()}Content`} value={value} />
        ))}
        <input type="hidden" name="hashtags" value={hashtags} />
        <input type="hidden" name="linkUrl" value={linkUrl} />

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main composer */}
          <div className="space-y-5">
            {/* Platform selector */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-800">Post to</label>
              <div className="flex flex-wrap gap-2">
                {(['FACEBOOK', 'TWITTER', 'TIKTOK', 'INSTAGRAM', 'GOOGLE_MY_BUSINESS'] as SocialMediaPlatform[]).map(
                  (platform) => {
                    const Icon = PLATFORM_ICONS[platform]
                    const config = PLATFORM_CONFIGS[platform]
                    const isSelected = selectedPlatforms.has(platform)
                    const isConnected = connectedPlatforms.has(platform)

                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        disabled={!isConnected}
                        className={cn(
                          'flex items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition-all',
                          isSelected
                            ? PLATFORM_COLORS[platform]
                            : isConnected
                              ? 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                              : 'cursor-not-allowed border-dashed border-slate-200 bg-slate-50 text-slate-400',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {config.shortLabel}
                        {!isConnected && (
                          <span className="text-xs text-slate-400">Setup needed</span>
                        )}
                        {/* Hidden checkbox for form submission */}
                        {isSelected && (
                          <input type="hidden" name="platforms" value={platform} />
                        )}
                      </button>
                    )
                  },
                )}
              </div>
              {state.fieldErrors?.platforms && (
                <p className="text-xs text-red-600">{state.fieldErrors.platforms.join(' ')}</p>
              )}
            </div>

            {/* Content editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="content" className="text-sm font-medium text-slate-800">
                  Post content
                </label>
                <div className="flex gap-3">
                  {Array.from(selectedPlatforms).map((p) => {
                    const w = charWarnings[p]
                    if (!w) return null
                    const config = PLATFORM_CONFIGS[p]
                    return (
                      <span
                        key={p}
                        className={cn(
                          'text-xs',
                          w.over ? 'text-red-600 font-semibold' : w.count > w.max * 0.8 ? 'text-amber-600' : 'text-slate-400',
                        )}
                      >
                        {config.shortLabel}: {w.count}/{w.max}
                      </span>
                    )
                  })}
                </div>
              </div>
              <Textarea
                id="content"
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's happening with Jose Madrid Salsa today? Share new drops, events, recipes, or community moments..."
                rows={6}
                className="resize-y text-[15px] leading-relaxed"
              />
              {state.fieldErrors?.content && (
                <p className="text-xs text-red-600">{state.fieldErrors.content.join(' ')}</p>
              )}
            </div>

            {/* Platform-specific overrides */}
            {selectedPlatforms.size > 1 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowOverrides(!showOverrides)}
                  className="flex items-center gap-2 text-sm text-salsa-600 hover:text-salsa-700"
                >
                  <Eye className="h-4 w-4" />
                  {showOverrides ? 'Hide' : 'Customize'} per-platform content
                </button>

                {showOverrides && (
                  <div className="mt-3 space-y-3">
                    {Array.from(selectedPlatforms).map((platform) => {
                      const Icon = PLATFORM_ICONS[platform]
                      const config = PLATFORM_CONFIGS[platform]
                      return (
                        <div key={platform} className="space-y-1.5">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                            <Icon className="h-3.5 w-3.5" />
                            {config.label} version
                            <span className="text-slate-400">(optional, overrides main content)</span>
                          </label>
                          <Textarea
                            value={platformOverrides[platform] || ''}
                            onChange={(e) =>
                              setPlatformOverrides((prev) => ({
                                ...prev,
                                [platform]: e.target.value,
                              }))
                            }
                            placeholder={`Custom content for ${config.label}... Leave blank to use main content.`}
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Extras: hashtags and link */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Hash className="h-4 w-4 text-slate-400" />
                  Hashtags
                </label>
                <Input
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="salsa, josemadrid, homemade"
                  className="text-sm"
                />
                <p className="text-xs text-slate-400">Comma-separated. Auto-prefixed with #</p>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Link2 className="h-4 w-4 text-slate-400" />
                  Link URL
                </label>
                <Input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://josemadrid.net/..."
                  className="text-sm"
                />
                <p className="text-xs text-slate-400">Attached to Facebook/X posts</p>
              </div>
            </div>

            {/* Scheduling */}
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-salsa-600 focus:ring-salsa-500"
                  checked={scheduleEnabled}
                  onChange={(e) => setScheduleEnabled(e.target.checked)}
                  disabled={!canSchedule}
                />
                <span className="text-sm font-medium text-slate-800">Schedule for later</span>
                {!canSchedule && (
                  <span className="text-xs text-slate-400">(requires scheduling permission)</span>
                )}
              </label>
              {scheduleEnabled && (
                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  <Input
                    type="datetime-local"
                    name="scheduledAt"
                    className="max-w-xs text-sm"
                  />
                </div>
              )}
              {state.fieldErrors?.scheduledAt && (
                <p className="text-xs text-red-600">{state.fieldErrors.scheduledAt.join(' ')}</p>
              )}
            </div>

            {/* Submit buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <ComposerButton intent="draft" disabled={selectedPlatforms.size === 0 || !content.trim()}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </ComposerButton>
              {canSchedule && (
                <ComposerButton
                  intent="schedule"
                  disabled={selectedPlatforms.size === 0 || !content.trim() || !scheduleEnabled}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Schedule
                </ComposerButton>
              )}
              {canPublish && (
                <ComposerButton
                  intent="publish"
                  variant="default"
                  disabled={selectedPlatforms.size === 0 || !content.trim() || hasOverLimit}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Publish Now
                </ComposerButton>
              )}
            </div>
          </div>

          {/* Preview panel */}
          <div className="space-y-4">
            <Card className="sticky top-4 overflow-hidden">
              <div className="border-b bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-700">Live Preview</p>
                {selectedPlatforms.size > 0 && (
                  <div className="mt-2 flex gap-1">
                    {Array.from(selectedPlatforms).map((p) => {
                      const Icon = PLATFORM_ICONS[p]
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setActivePreviewPlatform(p)}
                          className={cn(
                            'rounded-lg p-1.5 transition',
                            activePreviewPlatform === p
                              ? 'bg-white shadow-sm'
                              : 'hover:bg-white/50',
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              <div className="p-4">
                {!content.trim() && selectedPlatforms.size === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center text-slate-400">
                    <Eye className="mb-2 h-8 w-8" />
                    <p className="text-sm">Select platforms and start typing to see a preview</p>
                  </div>
                ) : (
                  <PostPreview
                    platform={activePreviewPlatform}
                    content={getContentForPlatform(activePreviewPlatform)}
                    hashtags={hashtags}
                    linkUrl={linkUrl}
                    account={accounts.find((a) => a.platform === activePreviewPlatform)}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      </form>
    </div>
  )
}

function PostPreview({
  platform,
  content,
  hashtags,
  linkUrl,
  account,
}: {
  platform: SocialMediaPlatform
  content: string
  hashtags: string
  linkUrl: string
  account?: SocialAccountInfo
}) {
  const config = PLATFORM_CONFIGS[platform]
  const Icon = PLATFORM_ICONS[platform]
  const hashtagText = hashtags
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .join(' ')

  const fullContent = content + (hashtagText ? '\n\n' + hashtagText : '')

  return (
    <div className="space-y-3">
      {/* Platform header */}
      <div className="flex items-center gap-3">
        {account?.profileImageUrl ? (
          <img src={account.profileImageUrl} alt="" className="h-10 w-10 rounded-full" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
            <Icon className="h-5 w-5 text-slate-500" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {account?.accountName || 'Jose Madrid Salsa'}
          </p>
          <p className="text-xs text-slate-500">
            {account?.accountHandle || `@JoseMadridSalsa`} · Just now
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
        {fullContent || <span className="italic text-slate-400">Start typing your post...</span>}
      </div>

      {/* Link preview */}
      {linkUrl && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="truncate text-xs text-slate-500">{linkUrl}</p>
          <p className="mt-1 text-sm font-medium text-slate-700">Link Preview</p>
        </div>
      )}

      {/* Character count */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs">
        <span className="text-slate-400">{config.label} preview</span>
        <span
          className={cn(
            fullContent.length > config.maxChars
              ? 'font-semibold text-red-600'
              : fullContent.length > config.maxChars * 0.8
                ? 'text-amber-600'
                : 'text-slate-400',
          )}
        >
          {fullContent.length} / {config.maxChars}
        </span>
      </div>
    </div>
  )
}

type ComposerButtonProps = {
  intent: 'draft' | 'schedule' | 'publish'
  variant?: 'default' | 'outline'
  disabled?: boolean
  children: React.ReactNode
}

function ComposerButton({ intent, variant = 'outline', disabled, children }: ComposerButtonProps) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      disabled={disabled || pending}
      className="min-w-[130px]"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Saving...' : children}
    </Button>
  )
}
