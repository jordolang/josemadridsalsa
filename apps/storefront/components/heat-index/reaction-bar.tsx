'use client'

import { useState } from 'react'
import { Flame, Heart, Laugh, Sparkles } from 'lucide-react'
import { useSession, signIn } from 'next-auth/react'
import { toast } from 'sonner'

type ReactionKind = 'FIRE' | 'HEART' | 'LAUGH' | 'MIND_BLOWN'

interface ReactionBarProps {
  postSlug: string
  initialCounts: Record<ReactionKind, number>
}

const REACTIONS: { kind: ReactionKind; label: string; Icon: typeof Flame; activeClass: string }[] =
  [
    { kind: 'FIRE', label: 'Fire', Icon: Flame, activeClass: 'text-salsa-600' },
    { kind: 'HEART', label: 'Heart', Icon: Heart, activeClass: 'text-pink-600' },
    { kind: 'LAUGH', label: 'Laugh', Icon: Laugh, activeClass: 'text-amber-500' },
    { kind: 'MIND_BLOWN', label: 'Mind blown', Icon: Sparkles, activeClass: 'text-violet-600' },
  ]

export function ReactionBar({ postSlug, initialCounts }: ReactionBarProps) {
  const { data: session } = useSession()
  const [counts, setCounts] = useState<Record<ReactionKind, number>>(initialCounts)
  const [mine, setMine] = useState<Set<ReactionKind>>(new Set())
  const [pending, setPending] = useState<ReactionKind | null>(null)

  async function toggle(kind: ReactionKind) {
    if (!session) {
      toast.info('Sign in to react', {
        action: { label: 'Sign in', onClick: () => signIn() },
      })
      return
    }
    if (pending) return
    setPending(kind)

    const isOn = mine.has(kind)
    // Optimistic update
    setMine((prev) => {
      const next = new Set(prev)
      if (isOn) next.delete(kind)
      else next.add(kind)
      return next
    })
    setCounts((prev) => ({ ...prev, [kind]: Math.max(0, prev[kind] + (isOn ? -1 : 1)) }))

    try {
      const res = await fetch(`/api/heat-index/posts/${postSlug}/reactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      if (!res.ok) throw new Error('Reaction failed')
    } catch {
      // Revert
      setMine((prev) => {
        const next = new Set(prev)
        if (isOn) next.add(kind)
        else next.delete(kind)
        return next
      })
      setCounts((prev) => ({ ...prev, [kind]: Math.max(0, prev[kind] + (isOn ? 1 : -1)) }))
      toast.error('Could not save your reaction')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-2">
        Bring the heat
      </span>
      {REACTIONS.map(({ kind, label, Icon, activeClass }) => {
        const active = mine.has(kind)
        return (
          <button
            key={kind}
            type="button"
            onClick={() => toggle(kind)}
            disabled={pending !== null}
            aria-pressed={active}
            aria-label={label}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all disabled:opacity-60 ${
              active
                ? `border-current bg-card ${activeClass} shadow-sm`
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30'
            }`}
          >
            <Icon className={`w-4 h-4 ${active ? 'fill-current' : ''}`} />
            <span>{counts[kind]}</span>
          </button>
        )
      })}
    </div>
  )
}
