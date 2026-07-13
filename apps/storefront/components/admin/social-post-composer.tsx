'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { CalendarDays, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { SocialComposerState, SocialPlatformOption } from '@/types/social'

type SocialPostComposerProps = {
  action: (state: SocialComposerState, formData: FormData) => Promise<SocialComposerState>
  platformOptions: SocialPlatformOption[]
  canSchedule: boolean
  canPublish: boolean
}

const TWITTER_CHAR_LIMIT = 280
const INITIAL_STATE: SocialComposerState = { status: 'idle' }

export function SocialPostComposer({
  action,
  platformOptions,
  canSchedule,
  canPublish,
}: SocialPostComposerProps) {
  const [state, formAction] = useFormState(action, INITIAL_STATE)
  const [content, setContent] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)

  useEffect(() => {
    if (state.status === 'success') {
      setContent('')
      setScheduleEnabled(false)
    }
  }, [state])

  const charCount = content.length
  const exceedsTwitterLimit = charCount > TWITTER_CHAR_LIMIT

  const connectedPlatforms = useMemo(
    () => platformOptions.filter((platform) => platform.isConnected),
    [platformOptions],
  )

  const disconnectedPlatforms = useMemo(
    () => platformOptions.filter((platform) => !platform.isConnected),
    [platformOptions],
  )

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Composer</p>
          <h2 className="font-serif text-2xl font-semibold text-foreground">Create a social post</h2>
          <p className="text-sm text-muted-foreground">
            Draft once and push to every connected platform. Schedule posts or mark them as published when you launch.
          </p>
        </div>
        <Badge variant="outline" className="border-border text-xs text-primary">
          {connectedPlatforms.length} platform{connectedPlatforms.length === 1 ? '' : 's'} connected
        </Badge>
      </div>

      {disconnectedPlatforms.length > 0 ? (
        <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
          Connect{' '}
          {disconnectedPlatforms
            .map((platform) => platform.label)
            .join(', ')}{' '}
          in Settings → Integrations to unlock cross-posting.
        </div>
      ) : null}

      {state.status === 'success' ? (
        <div className="rounded-xl border border-border bg-primary/5 px-4 py-3 text-sm text-primary">
          {state.message}
        </div>
      ) : null}

      {state.status === 'error' && state.message ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      ) : null}

      <form action={formAction} className="space-y-6">
        <fieldset className="space-y-4">
          <legend className="text-sm font-medium text-foreground">Select platforms</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {platformOptions.map((platform) => (
              <Label
                key={platform.value}
                htmlFor={`platform-${platform.value}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 font-normal transition',
                  platform.isConnected
                    ? 'border-border bg-muted/50 hover:border-input'
                    : 'border-border bg-muted/20 hover:border-input',
                )}
              >
                <Checkbox
                  id={`platform-${platform.value}`}
                  name="platforms"
                  value={platform.value}
                  className="mt-1"
                  defaultChecked={platform.isConnected}
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{platform.label}</span>
                    {platform.handle ? (
                      <span className="text-xs text-muted-foreground">{platform.handle}</span>
                    ) : null}
                    {platform.isConnected ? (
                      <Badge>Connected</Badge>
                    ) : (
                      <Badge variant="outline">Connect</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{platform.description}</p>
                  {platform.lastSyncedAt ? (
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Synced {new Date(platform.lastSyncedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              </Label>
            ))}
          </div>
          {state.fieldErrors?.platforms ? (
            <p className="text-xs text-destructive">{state.fieldErrors.platforms.join(' ')}</p>
          ) : null}
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="content" className="text-sm font-medium text-foreground">
              Post copy
            </label>
            <p
              className={cn(
                'text-xs',
                exceedsTwitterLimit ? 'text-destructive' : charCount > 180 ? 'text-muted-foreground' : 'text-muted-foreground',
              )}
            >
              {charCount} / {TWITTER_CHAR_LIMIT} for X
            </p>
          </div>
          <Textarea
            id="content"
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Announce new salsa drops, fundraising milestones, or tasting events..."
            rows={5}
            className="resize-y"
          />
          {state.fieldErrors?.content ? (
            <p className="text-xs text-destructive">{state.fieldErrors.content.join(' ')}</p>
          ) : null}
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Scheduling</legend>
          <div className="flex items-center gap-2">
            <Checkbox
              id="schedule-enabled"
              checked={scheduleEnabled}
              onCheckedChange={(checked) => setScheduleEnabled(checked === true)}
              disabled={!canSchedule}
            />
            <Label htmlFor="schedule-enabled" className="font-normal text-muted-foreground">
              Enable scheduling
              {!canSchedule ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  (requires scheduling permission)
                </span>
              ) : null}
            </Label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                type="datetime-local"
                name="scheduledAt"
                disabled={!scheduleEnabled}
                className="w-full"
              />
              {state.fieldErrors?.scheduledAt ? (
                <p className="text-xs text-destructive">{state.fieldErrors.scheduledAt.join(' ')}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              Tip: schedule fundraisers 24 hours before launch.
            </div>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            Saved posts appear immediately in the table below. Scheduling queues the content for approval.
          </div>
          <div className="flex flex-wrap gap-2">
            <ComposerSubmitButton intent="draft" label="Save as draft" />
            {canSchedule ? <ComposerSubmitButton intent="schedule" label="Schedule post" disabled={!scheduleEnabled} /> : null}
            {canPublish ? <ComposerSubmitButton intent="publish" label="Mark as published" variant="outline" /> : null}
          </div>
        </div>
      </form>
    </div>
  )
}

type ComposerSubmitButtonProps = {
  intent: 'draft' | 'schedule' | 'publish'
  label: string
  disabled?: boolean
  variant?: 'default' | 'outline'
}

function ComposerSubmitButton({ intent, label, disabled, variant = 'default' }: ComposerSubmitButtonProps) {
  const { pending } = useFormStatus()
  const isDisabled = disabled || pending

  return (
    <Button
      type="submit"
      name="intent"
      value={intent}
      variant={variant}
      disabled={isDisabled}
      className="min-w-[140px]"
    >
      {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
      {pending ? 'Submitting...' : label}
    </Button>
  )
}
