"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSession } from 'next-auth/react'

export function MessageWidget() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/messages/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message, email: session?.user?.email ? undefined : email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to send message')
      }
      setSent(true)
      setSubject('')
      setMessage('')
      setEmail('')
    } catch (e: any) {
      setError(e?.message || 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="rounded-full shadow-lg bg-salsa-600 hover:bg-salsa-700">Message Admin</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Message the Admin</DialogTitle>
          </DialogHeader>
          {sent ? (
            <div className="space-y-3">
              <div className="text-green-700">Thanks! Your message has been sent.</div>
              <Button onClick={() => { setSent(false); setOpen(false) }}>Close</Button>
            </div>
          ) : (
            <div className="space-y-3">
              {!session?.user?.email && (
                <div>
                  <label className="block text-sm mb-1">Your Email</label>
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm mb-1">Subject</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="How can we help?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Message</label>
                <textarea
                  className="w-full border rounded px-3 py-2 h-32"
                  placeholder="Type your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              {error && <div className="text-red-600 text-sm">{error}</div>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit} disabled={sending || !message || (!session?.user?.email && !email)}>
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
