'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { toast } from 'sonner'

const EMAIL_CATEGORIES = [
  { key: 'marketing', label: 'Promotions & Offers', description: 'Discounts, sales, and special deals' },
  {
    key: 'newsletter',
    label: 'Newsletter',
    description: 'Updates, recipes, and company news',
  },
  {
    key: 'reengagement',
    label: 'Re-engagement',
    description: 'Come-back offers and reminders',
  },
]

export function UnsubscribeForm() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''
  const listId = searchParams.get('list') ?? ''

  const [unsubscribeAll, setUnsubscribeAll] = useState(false)
  const [unsubscribedFrom, setUnsubscribedFrom] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  useEffect(() => {
    if (!email) {
      setLoadingPrefs(false)
      return
    }
    fetch(`/api/unsubscribe?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        setUnsubscribeAll(data.unsubscribeAll ?? false)
        setUnsubscribedFrom(data.unsubscribedFrom ?? [])
      })
      .catch(() => {})
      .finally(() => setLoadingPrefs(false))
  }, [email, token])

  const toggleCategory = (key: string) => {
    setUnsubscribedFrom((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleSave = async () => {
    if (!email) {
      toast.error('No email address provided')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          categories: unsubscribedFrom,
          unsubscribeAll,
          ...(listId ? { listId } : {}),
        }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      toast.success('Preferences saved')
    } catch {
      toast.error('Failed to save preferences')
    } finally {
      setLoading(false)
    }
  }

  if (!email) {
    return (
      <div className="text-center py-4">
        <p className="text-muted-foreground">
          No email address provided. Please use the unsubscribe link in your email.
        </p>
      </div>
    )
  }

  if (saved) {
    return (
      <div className="text-center py-4 space-y-3">
        <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-semibold">Preferences Saved</h2>
        <p className="text-muted-foreground">
          {unsubscribeAll
            ? 'You have been unsubscribed from all marketing emails. You will still receive important transactional emails about your orders.'
            : 'Your email preferences have been updated.'}
        </p>
      </div>
    )
  }

  if (loadingPrefs) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
        <Mail className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-800 font-medium">{email}</p>
      </div>

      <div className="space-y-3">
        {EMAIL_CATEGORIES.map((cat) => (
          <div key={cat.key} className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium text-sm">{cat.label}</p>
              <p className="text-xs text-muted-foreground">{cat.description}</p>
            </div>
            <Switch
              checked={!unsubscribedFrom.includes(cat.key) && !unsubscribeAll}
              onCheckedChange={() => toggleCategory(cat.key)}
              disabled={unsubscribeAll}
            />
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">Unsubscribe from all</p>
            <p className="text-xs text-muted-foreground">
              Stop all marketing emails (transactional emails still sent)
            </p>
          </div>
          <Switch checked={unsubscribeAll} onCheckedChange={setUnsubscribeAll} />
        </div>
      </div>

      <Button className="w-full" onClick={handleSave} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Preferences'
        )}
      </Button>
    </div>
  )
}
