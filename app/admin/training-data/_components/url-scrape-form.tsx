'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function UrlScrapeForm() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  )

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch('/api/admin/training-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: title.trim() ? title.trim() : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to scrape URL')
      }

      setFeedback({ type: 'success', message: 'URL scraped and queued for training.' })
      setUrl('')
      setTitle('')
      setNotes('')
      router.refresh()
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.message || 'Scrape failed. Try again shortly.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="training-url">Source URL</Label>
        <Input
          id="training-url"
          type="url"
          placeholder="https://example.com/article"
          required
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="training-title">Override title</Label>
        <Input
          id="training-title"
          placeholder="Auto-detected if left blank"
          value={title}
          maxLength={160}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="training-url-notes">Notes</Label>
        <Textarea
          id="training-url-notes"
          placeholder="Add curator context, summaries, or reminders for this source."
          maxLength={2_000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Scrape & ingest
      </Button>

      {feedback && (
        <p
          className={`text-sm ${
            feedback.type === 'success' ? 'text-emerald-600' : 'text-red-600'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </form>
  )
}
