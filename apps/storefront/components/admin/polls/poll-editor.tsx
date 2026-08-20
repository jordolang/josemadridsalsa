'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MediaPicker } from '@/components/admin/cms/media-picker'
import { STATUS_OPTIONS } from '@/components/admin/cms/status'
import { DEFAULT_CONSENT_NOTICE, MAX_COMMENT_LENGTH, POLL_ACCENTS } from '@/lib/polls/constants'

export interface EditorOption {
  id?: string
  label: string
  description: string
  imageUrl: string
  emoji: string
}

export interface EditorQuestion {
  id?: string
  /** Stable key for React while a question has no database id yet. */
  key: string
  type: 'SINGLE_CHOICE' | 'MULTI_CHOICE' | 'SHORT_TEXT' | 'LONG_TEXT' | 'RATING'
  prompt: string
  helpText: string
  imageUrl: string
  imageAlt: string
  isRequired: boolean
  maxLength: number
  placeholder: string
  minSelections: string
  maxSelections: string
  allowOther: boolean
  ratingMax: number
  options: EditorOption[]
}

export interface EditorPoll {
  id: string
  slug: string
  title: string
  subtitle: string
  description: string
  imageUrl: string
  imageAlt: string
  accentColor: string
  status: string
  visibility: string
  accessCode: string | null
  featured: boolean
  sortOrder: number
  publishedAt: string
  startsAt: string
  endsAt: string
  resultsVisibility: string
  allowMultipleSubmissions: boolean
  collectEmail: boolean
  consentNotice: string
  thankYouMessage: string
  closedMessage: string
  seoTitle: string
  seoDescription: string
  noIndex: boolean
  responseCount: number
}

const QUESTION_TYPES = [
  { value: 'SINGLE_CHOICE', label: 'Pick one (radio pills)' },
  { value: 'MULTI_CHOICE', label: 'Pick all that apply (check pills)' },
  { value: 'SHORT_TEXT', label: 'Short written answer' },
  { value: 'LONG_TEXT', label: 'Long comment' },
  { value: 'RATING', label: 'Rating scale' },
]

const RESULTS_OPTIONS = [
  { value: 'AFTER_VOTE', label: 'After someone votes' },
  { value: 'ALWAYS', label: 'Always visible' },
  { value: 'HIDDEN', label: 'Never — keep them internal' },
]

const emptyQuestion = (key: string): EditorQuestion => ({
  key,
  type: 'SINGLE_CHOICE',
  prompt: '',
  helpText: '',
  imageUrl: '',
  imageAlt: '',
  isRequired: false,
  maxLength: MAX_COMMENT_LENGTH,
  placeholder: '',
  minSelections: '',
  maxSelections: '',
  allowOther: false,
  ratingMax: 5,
  options: [
    { label: '', description: '', imageUrl: '', emoji: '' },
    { label: '', description: '', imageUrl: '', emoji: '' },
  ],
})

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in local time; the API speaks ISO. */
function toLocalInput(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/**
 * The poll workbench: settings, the question builder and the responses that
 * have come in, all saved through one PATCH.
 */
export function PollEditor({
  poll: initialPoll,
  questions: initialQuestions,
}: {
  poll: EditorPoll
  questions: EditorQuestion[]
}) {
  const router = useRouter()
  const [poll, setPoll] = useState(initialPoll)
  const [questions, setQuestions] = useState(initialQuestions)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('settings')
  const [pendingQuestionRemoval, setPendingQuestionRemoval] = useState<{
    key: string
    prompt: string
  } | null>(null)

  // The polls table links straight to #responses; open that tab when it does.
  useEffect(() => {
    if (window.location.hash === '#responses') setTab('responses')
  }, [])

  const setField = <K extends keyof EditorPoll>(field: K, value: EditorPoll[K]) =>
    setPoll((current) => ({ ...current, [field]: value }))

  const updateQuestion = (index: number, patch: Partial<EditorQuestion>) =>
    setQuestions((current) =>
      current.map((question, i) => (i === index ? { ...question, ...patch } : question))
    )

  const moveQuestion = (index: number, direction: -1 | 1) =>
    setQuestions((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const updateOption = (questionIndex: number, optionIndex: number, patch: Partial<EditorOption>) =>
    setQuestions((current) =>
      current.map((question, i) =>
        i === questionIndex
          ? {
              ...question,
              options: question.options.map((option, j) =>
                j === optionIndex ? { ...option, ...patch } : option
              ),
            }
          : question
      )
    )

  async function save() {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/cms/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: poll.slug,
          title: poll.title,
          subtitle: poll.subtitle || null,
          description: poll.description || null,
          imageUrl: poll.imageUrl || null,
          imageAlt: poll.imageAlt || null,
          accentColor: poll.accentColor || null,
          status: poll.status,
          visibility: poll.visibility,
          featured: poll.featured,
          sortOrder: poll.sortOrder,
          publishedAt: fromLocalInput(poll.publishedAt),
          startsAt: fromLocalInput(poll.startsAt),
          endsAt: fromLocalInput(poll.endsAt),
          resultsVisibility: poll.resultsVisibility,
          allowMultipleSubmissions: poll.allowMultipleSubmissions,
          collectEmail: poll.collectEmail,
          consentNotice: poll.consentNotice || null,
          thankYouMessage: poll.thankYouMessage || null,
          closedMessage: poll.closedMessage || null,
          seoTitle: poll.seoTitle || null,
          seoDescription: poll.seoDescription || null,
          noIndex: poll.noIndex,
          questions: questions.map((question, index) => ({
            ...(question.id ? { id: question.id } : {}),
            type: question.type,
            prompt: question.prompt,
            helpText: question.helpText || null,
            imageUrl: question.imageUrl || null,
            imageAlt: question.imageAlt || null,
            isRequired: question.isRequired,
            maxLength: question.maxLength,
            placeholder: question.placeholder || null,
            minSelections: question.minSelections === '' ? null : Number(question.minSelections),
            maxSelections: question.maxSelections === '' ? null : Number(question.maxSelections),
            allowOther: question.allowOther,
            ratingMax: question.ratingMax,
            sortOrder: index,
            options:
              question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE'
                ? question.options
                    .filter((option) => option.label.trim() !== '')
                    .map((option, optionIndex) => ({
                      ...(option.id ? { id: option.id } : {}),
                      label: option.label,
                      description: option.description || null,
                      imageUrl: option.imageUrl || null,
                      emoji: option.emoji || null,
                      sortOrder: optionIndex,
                    }))
                : [],
          })),
        }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the poll')
      toast.success('Poll saved')
      setPoll((current) => ({ ...current, accessCode: payload.poll?.accessCode ?? null }))
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the poll')
    } finally {
      setSaving(false)
    }
  }

  const shareUrl =
    poll.visibility === 'INVITE_ONLY' && poll.accessCode
      ? `/polls/${poll.slug}?key=${poll.accessCode}`
      : `/polls/${poll.slug}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{poll.title || 'Untitled poll'}</h1>
          <p className="text-muted-foreground">
            {poll.responseCount} response{poll.responseCount === 1 ? '' : 's'} so far
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={shareUrl} target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Preview
            </Link>
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save poll
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="settings">Poll</TabsTrigger>
          <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          <TabsTrigger value="responses">Responses</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6 pt-4">
          <Card className="space-y-4 p-6">
            <h2 className="font-semibold">What people see</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={poll.title}
                  onChange={(event) => setField('title', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="slug">URL</Label>
                <Input
                  id="slug"
                  value={poll.slug}
                  onChange={(event) => setField('slug', event.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">/polls/{poll.slug}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={poll.subtitle}
                onChange={(event) => setField('subtitle', event.target.value)}
                placeholder="One line under the title"
              />
            </div>
            <div>
              <Label htmlFor="description">Intro</Label>
              <Textarea
                id="description"
                rows={4}
                value={poll.description}
                onChange={(event) => setField('description', event.target.value)}
                placeholder="A short welcome above the questions. Optional."
              />
            </div>
            <MediaPicker
              label="Poll image (optional)"
              value={poll.imageUrl}
              onChange={(url) => setField('imageUrl', url)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="imageAlt">Image description</Label>
                <Input
                  id="imageAlt"
                  value={poll.imageAlt}
                  onChange={(event) => setField('imageAlt', event.target.value)}
                  placeholder="Describes the image for screen readers"
                />
              </div>
              <div>
                <Label>Accent colour</Label>
                <Select
                  value={poll.accentColor || 'salsa'}
                  onValueChange={(value) => setField('accentColor', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLL_ACCENTS.map((accent) => (
                      <SelectItem key={accent} value={accent}>
                        {accent.charAt(0).toUpperCase() + accent.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-semibold">Who can see it, and when</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label>Status</Label>
                <Select value={poll.status} onValueChange={(value) => setField('status', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Visibility</Label>
                <Select
                  value={poll.visibility}
                  onValueChange={(value) => setField('visibility', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC">Public — listed on /polls</SelectItem>
                    <SelectItem value="INVITE_ONLY">Invite only — share link required</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Show results</Label>
                <Select
                  value={poll.resultsVisibility}
                  onValueChange={(value) => setField('resultsVisibility', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULTS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {poll.visibility === 'INVITE_ONLY' && (
              <div className="rounded-md border border-dashed p-4 text-sm">
                {poll.accessCode ? (
                  <>
                    <p className="font-medium">Share link</p>
                    <p className="mt-1 break-all text-muted-foreground">{shareUrl}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}${shareUrl}`)
                        toast.success('Share link copied')
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </Button>
                  </>
                ) : (
                  <p className="text-muted-foreground">
                    Save the poll to mint its share link. Anyone with that link can answer; anyone
                    without it gets a not-found page.
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="publishedAt">Published</Label>
                <Input
                  id="publishedAt"
                  type="datetime-local"
                  value={toLocalInput(poll.publishedAt)}
                  onChange={(event) => setField('publishedAt', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="startsAt">Opens</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={toLocalInput(poll.startsAt)}
                  onChange={(event) => setField('startsAt', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endsAt">Closes</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={toLocalInput(poll.endsAt)}
                  onChange={(event) => setField('endsAt', event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <ToggleRow
                label="Feature on the polls page"
                hint="Featured polls sort to the top."
                checked={poll.featured}
                onChange={(value) => setField('featured', value)}
              />
              <ToggleRow
                label="Allow more than one answer per device"
                hint="Off means one response per device, which is usually what you want."
                checked={poll.allowMultipleSubmissions}
                onChange={(value) => setField('allowMultipleSubmissions', value)}
              />
              <ToggleRow
                label="Ask for an email address"
                hint="Always optional for the visitor."
                checked={poll.collectEmail}
                onChange={(value) => setField('collectEmail', value)}
              />
              <ToggleRow
                label="Keep out of search engines"
                hint="Invite-only polls are hidden from search automatically."
                checked={poll.noIndex}
                onChange={(value) => setField('noIndex', value)}
              />
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="font-semibold">Wording</h2>
            <div>
              <Label htmlFor="consentNotice">Participation notice</Label>
              <Textarea
                id="consentNotice"
                rows={4}
                value={poll.consentNotice}
                onChange={(event) => setField('consentNotice', event.target.value)}
                placeholder={DEFAULT_CONSENT_NOTICE}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty to use the standard notice about promotional and internal use.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="thankYouMessage">Thank-you message</Label>
                <Textarea
                  id="thankYouMessage"
                  rows={3}
                  value={poll.thankYouMessage}
                  onChange={(event) => setField('thankYouMessage', event.target.value)}
                  placeholder="Shown right after someone submits."
                />
              </div>
              <div>
                <Label htmlFor="closedMessage">Closed message</Label>
                <Textarea
                  id="closedMessage"
                  rows={3}
                  value={poll.closedMessage}
                  onChange={(event) => setField('closedMessage', event.target.value)}
                  placeholder="Shown once the poll has closed."
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="seoTitle">Meta title</Label>
                <Input
                  id="seoTitle"
                  value={poll.seoTitle}
                  onChange={(event) => setField('seoTitle', event.target.value)}
                  placeholder="30–60 characters"
                />
              </div>
              <div>
                <Label htmlFor="seoDescription">Meta description</Label>
                <Input
                  id="seoDescription"
                  value={poll.seoDescription}
                  onChange={(event) => setField('seoDescription', event.target.value)}
                  placeholder="Up to 160 characters"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="questions" className="space-y-4 pt-4">
          {questions.map((question, index) => (
            <Card key={question.key} className="space-y-4 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Badge variant="outline">Question {index + 1}</Badge>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Move up"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Move down"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove question"
                    onClick={() => {
                      // A saved question takes its answers with it when the poll
                      // is saved, so ask first. A question added in this session
                      // has nothing to lose.
                      if (question.id) {
                        setPendingQuestionRemoval({ key: question.key, prompt: question.prompt })
                      } else {
                        setQuestions((current) => current.filter((_, i) => i !== index))
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Answer style</Label>
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestion(index, { type: value as EditorQuestion['type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ToggleRow
                  label="Must be answered"
                  checked={question.isRequired}
                  onChange={(value) => updateQuestion(index, { isRequired: value })}
                />
              </div>

              <div>
                <Label>Question</Label>
                <Textarea
                  rows={2}
                  value={question.prompt}
                  onChange={(event) => updateQuestion(index, { prompt: event.target.value })}
                  placeholder="What would you like to ask?"
                />
              </div>

              <div>
                <Label>Help text</Label>
                <Input
                  value={question.helpText}
                  onChange={(event) => updateQuestion(index, { helpText: event.target.value })}
                  placeholder="Optional line under the question"
                />
              </div>

              <MediaPicker
                label="Question image (optional)"
                value={question.imageUrl}
                onChange={(url) => updateQuestion(index, { imageUrl: url })}
              />

              {(question.type === 'SHORT_TEXT' || question.type === 'LONG_TEXT') && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Character limit</Label>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_COMMENT_LENGTH}
                      value={question.maxLength}
                      onChange={(event) =>
                        updateQuestion(index, {
                          maxLength: Math.min(
                            MAX_COMMENT_LENGTH,
                            Math.max(1, Number(event.target.value) || MAX_COMMENT_LENGTH)
                          ),
                        })
                      }
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Up to {MAX_COMMENT_LENGTH} characters.
                    </p>
                  </div>
                  <div>
                    <Label>Placeholder</Label>
                    <Input
                      value={question.placeholder}
                      onChange={(event) =>
                        updateQuestion(index, { placeholder: event.target.value })
                      }
                      placeholder="Shown in the empty box"
                    />
                  </div>
                </div>
              )}

              {question.type === 'RATING' && (
                <div className="sm:w-48">
                  <Label>Top of the scale</Label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={question.ratingMax}
                    onChange={(event) =>
                      updateQuestion(index, {
                        ratingMax: Math.min(10, Math.max(2, Number(event.target.value) || 5)),
                      })
                    }
                  />
                </div>
              )}

              {(question.type === 'SINGLE_CHOICE' || question.type === 'MULTI_CHOICE') && (
                <div className="space-y-3">
                  {question.type === 'MULTI_CHOICE' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label>Fewest choices</Label>
                        <Input
                          type="number"
                          min={0}
                          value={question.minSelections}
                          onChange={(event) =>
                            updateQuestion(index, { minSelections: event.target.value })
                          }
                          placeholder="No minimum"
                        />
                      </div>
                      <div>
                        <Label>Most choices</Label>
                        <Input
                          type="number"
                          min={1}
                          value={question.maxSelections}
                          onChange={(event) =>
                            updateQuestion(index, { maxSelections: event.target.value })
                          }
                          placeholder="No maximum"
                        />
                      </div>
                    </div>
                  )}

                  <ToggleRow
                    label='Offer a "something else" box'
                    hint="Adds a free-text answer under the options."
                    checked={question.allowOther}
                    onChange={(value) => updateQuestion(index, { allowOther: value })}
                  />

                  <Label>Options</Label>
                  {question.options.map((option, optionIndex) => (
                    <div
                      key={option.id ?? `new-${optionIndex}`}
                      className="grid gap-2 rounded-md border p-3 sm:grid-cols-[5rem_1fr_auto]"
                    >
                      <Input
                        value={option.emoji}
                        onChange={(event) =>
                          updateOption(index, optionIndex, { emoji: event.target.value })
                        }
                        placeholder="🌶️"
                        aria-label="Emoji"
                      />
                      <div className="space-y-2">
                        <Input
                          value={option.label}
                          onChange={(event) =>
                            updateOption(index, optionIndex, { label: event.target.value })
                          }
                          placeholder="Option text"
                        />
                        <Input
                          value={option.description}
                          onChange={(event) =>
                            updateOption(index, optionIndex, { description: event.target.value })
                          }
                          placeholder="Small print under the option (optional)"
                        />
                        <MediaPicker
                          value={option.imageUrl}
                          onChange={(url) => updateOption(index, optionIndex, { imageUrl: url })}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Remove option"
                        onClick={() =>
                          updateQuestion(index, {
                            options: question.options.filter((_, j) => j !== optionIndex),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateQuestion(index, {
                        options: [
                          ...question.options,
                          { label: '', description: '', imageUrl: '', emoji: '' },
                        ],
                      })
                    }
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add option
                  </Button>
                </div>
              )}
            </Card>
          ))}

          <Button
            variant="outline"
            onClick={() =>
              setQuestions((current) => [
                ...current,
                emptyQuestion(`new-${Date.now()}-${current.length}`),
              ])
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add question
          </Button>
        </TabsContent>

        <TabsContent value="responses" className="pt-4">
          <ResponsesPanel pollId={poll.id} />
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={pendingQuestionRemoval !== null}
        onOpenChange={(open) => !open && setPendingQuestionRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this question?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingQuestionRemoval?.prompt || 'This question'}” has been saved, so any answers
              people have already given to it are deleted when you save the poll. Export the
              responses first if you want to keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setQuestions((current) =>
                  current.filter((question) => question.key !== pendingQuestionRemoval?.key)
                )
                setPendingQuestionRemoval(null)
              }}
            >
              Remove question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

interface ResponseRow {
  id: string
  submittedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  anonymousRequested: boolean
  creditedAs: string
  answers: { questionId: string; summary: string }[]
}

/** The answers that have come in, newest first, with a CSV export. */
function ResponsesPanel({ pollId }: { pollId: string }) {
  const [rows, setRows] = useState<ResponseRow[]>([])
  const [questions, setQuestions] = useState<{ id: string; prompt: string }[]>([])
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/cms/polls/${pollId}/responses`)
      if (!response.ok) throw new Error('Could not load the responses')
      const payload = await response.json()
      setRows(payload.responses ?? [])
      setQuestions(payload.questions ?? [])
      setTruncated(Boolean(payload.truncated))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the responses')
    } finally {
      setLoading(false)
    }
  }, [pollId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading responses…
      </p>
    )
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <Card className="p-6" id="responses">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">{rows.length} responses</h2>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/cms/polls/${pollId}/responses?format=csv`}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </a>
        </Button>
      </div>

      {truncated && (
        <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          This poll has more responses than can be shown at once. You are seeing the newest{' '}
          {rows.length}, and the export covers the same set.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nobody has answered yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Who</TableHead>
                {questions.map((question) => (
                  <TableHead key={question.id} className="min-w-48">
                    {question.prompt}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const byQuestion = new Map(row.answers.map((answer) => [answer.questionId, answer]))
                return (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.submittedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">
                        {row.firstName} {row.lastName ?? ''}
                      </p>
                      {row.anonymousRequested && (
                        <Badge variant="secondary" className="mt-1">
                          Wants anonymity — credit as {row.creditedAs}
                        </Badge>
                      )}
                      {row.email && (
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      )}
                    </TableCell>
                    {questions.map((question) => (
                      <TableCell key={question.id} className="max-w-md whitespace-pre-line text-sm">
                        {byQuestion.get(question.id)?.summary ?? '—'}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  )
}
