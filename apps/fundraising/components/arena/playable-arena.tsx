'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Gamepad2,
  MessageSquare,
  Music,
  Music2,
  Send,
  ShoppingCart,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useSession } from 'next-auth/react'
import type { ArenaSnapshot, ArenaTeam } from '@/lib/arena/server-state'
import { useArenaState } from '@/lib/arena/use-arena-state'
import { LeaderboardTable } from '@/components/arena/leaderboard-table'

type Position = { x: number; y: number }

type ArenaMessage = {
  id: string
  teamId: string | null
  author: string
  body: string
  createdAt: number
}

type DamageEvent = {
  id: string
  attackerId: string | null
  targetId: string
  amount: number
  createdAt: number
}

const ARENA_WIDTH = 1200
const ARENA_HEIGHT = 720
const PLAYER_SIZE = 42
const TEAM_SIZE = 78
const MOVE_STEP = 28
const MESSAGE_POLL_MS = 5000

const CLASS_EMBLEM: Record<string, string> = {
  warrior: 'W',
  mage: 'M',
  rogue: 'R',
  archer: 'A',
  paladin: 'P',
  berserker: 'B',
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function hashNumber(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function teamPosition(team: ArenaTeam, index: number, total: number): Position {
  const ringX = ARENA_WIDTH * 0.36
  const ringY = ARENA_HEIGHT * 0.28
  const angle = (Math.PI * 2 * index) / Math.max(1, total)
  const wobble = (hashNumber(team.id) % 80) - 40
  return {
    x: ARENA_WIDTH / 2 + Math.cos(angle) * (ringX + wobble),
    y: ARENA_HEIGHT / 2 + Math.sin(angle) * (ringY - wobble / 2),
  }
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function safeMessage(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120)
}

function useArenaAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)

  function play(kind: 'step' | 'message' | 'hit' | 'purchase') {
    if (!enabled || typeof window === 'undefined') return
    const audioWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext
    }
    const AudioContextCtor =
      globalThis.AudioContext || audioWindow.webkitAudioContext
    if (!AudioContextCtor) return

    const ctx = ctxRef.current ?? new AudioContextCtor()
    ctxRef.current = ctx

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = kind === 'hit' ? 'sawtooth' : kind === 'purchase' ? 'triangle' : 'sine'
    osc.frequency.value =
      kind === 'step'
        ? 170
        : kind === 'message'
          ? 520
          : kind === 'purchase'
            ? 680
            : 95
    gain.gain.value = kind === 'hit' ? 0.08 : 0.045
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16)
    osc.stop(ctx.currentTime + 0.18)
  }

  return play
}

function nearestTeam(
  teams: ArenaTeam[],
  positions: Map<string, Position>,
  player: Position,
): ArenaTeam | null {
  let best: { team: ArenaTeam; d: number } | null = null
  for (const team of teams) {
    const pos = positions.get(team.id)
    if (!pos) continue
    const d = distance(player, pos)
    if (!best || d < best.d) best = { team, d }
  }
  return best && best.d < 130 ? best.team : null
}

function PixelSprite({
  team,
  isPlayer = false,
  damaged = false,
}: {
  team?: ArenaTeam
  isPlayer?: boolean
  damaged?: boolean
}) {
  const character = team?.characters[0]
  const skin = character?.skinColor ?? '#9b6a43'
  const hair = character?.hairColor ?? '#21130c'
  const color = team?.teamColor ?? '#f59e0b'
  const emblem =
    CLASS_EMBLEM[character?.characterClass.toLowerCase() ?? ''] ??
    (isPlayer ? 'P' : 'T')

  return (
    <motion.div
      animate={
        damaged
          ? { x: [0, -8, 7, -4, 0], filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1)'] }
          : { y: [0, -5, 0] }
      }
      transition={
        damaged
          ? { duration: 0.42 }
          : { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
      }
      className={clsx(
        'relative mx-auto h-[70px] w-[54px]',
        isPlayer && 'drop-shadow-[0_0_16px_rgba(251,191,36,0.9)]',
      )}
      aria-hidden
    >
      <div
        className="absolute left-[15px] top-0 h-7 w-7 rounded-t-xl border-2 border-black/60"
        style={{ backgroundColor: hair }}
      />
      <div
        className="absolute left-[17px] top-[8px] h-7 w-6 rounded-b-lg border-2 border-black/60"
        style={{ backgroundColor: skin }}
      >
        <span className="absolute left-1.5 top-2 h-1 w-1 rounded-full bg-black" />
        <span className="absolute right-1.5 top-2 h-1 w-1 rounded-full bg-black" />
      </div>
      <div
        className="absolute left-[10px] top-[34px] flex h-8 w-9 items-center justify-center rounded border-2 border-black/70 text-[13px] font-black text-white shadow-[inset_0_8px_rgba(255,255,255,0.22)]"
        style={{ backgroundColor: color }}
      >
        {emblem}
      </div>
      <div className="absolute left-0 top-[38px] h-5 w-3 rounded bg-black/70" />
      <div className="absolute right-0 top-[38px] h-5 w-3 rounded bg-black/70" />
      <div className="absolute left-[13px] top-[62px] h-2 w-3 rounded bg-black" />
      <div className="absolute right-[9px] top-[62px] h-2 w-3 rounded bg-black" />
    </motion.div>
  )
}

function TeamActor({
  team,
  position,
  selected,
  damaged,
}: {
  team: ArenaTeam
  position: Position
  selected: boolean
  damaged: boolean
}) {
  const hpPct = team.hpMax > 0 ? clamp((team.hpCurrent / team.hpMax) * 100, 0, 100) : 0
  return (
    <motion.div
      layout
      className="absolute"
      style={{
        left: position.x - TEAM_SIZE / 2,
        top: position.y - TEAM_SIZE / 2,
        width: TEAM_SIZE,
      }}
      animate={{ scale: selected ? 1.08 : 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div
        className={clsx(
          'relative rounded-md border bg-black/55 px-2 pb-2 pt-3 text-center shadow-xl backdrop-blur',
          selected && 'ring-2 ring-amber-300',
        )}
        style={{ borderColor: `${team.teamColor}99` }}
      >
        {team.activeShield && (
          <span className="absolute -right-2 -top-2 rounded bg-cyan-300 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-950">
            Shield
          </span>
        )}
        <PixelSprite team={team} damaged={damaged} />
        <div className="mt-1 truncate text-[10px] font-black uppercase tracking-wider text-white">
          {team.name}
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-red-950">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>
    </motion.div>
  )
}

function DamageLayer({
  events,
  positions,
}: {
  events: DamageEvent[]
  positions: Map<string, Position>
}) {
  return (
    <AnimatePresence>
      {events.map((event) => {
        const target = positions.get(event.targetId)
        if (!target) return null
        const attacker = event.attackerId ? positions.get(event.attackerId) : null
        const start = attacker ?? { x: ARENA_WIDTH / 2, y: 60 }
        return (
          <motion.div
            key={event.id}
            className="pointer-events-none absolute left-0 top-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute h-3 w-12 rounded-full bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.9)]"
              style={{ left: start.x, top: start.y }}
              animate={{
                x: target.x - start.x,
                y: target.y - start.y,
                rotate: [0, 20, -12, 0],
              }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
            <motion.div
              className="absolute rounded bg-red-500 px-2 py-1 font-mono text-sm font-black text-white shadow-xl"
              style={{ left: target.x - 26, top: target.y - 86 }}
              initial={{ scale: 0.4, y: 18, opacity: 0 }}
              animate={{ scale: [0.4, 1.2, 1], y: -16, opacity: [0, 1, 1] }}
              exit={{ opacity: 0, y: -34 }}
              transition={{ duration: 0.7 }}
            >
              -{event.amount}
            </motion.div>
          </motion.div>
        )
      })}
    </AnimatePresence>
  )
}

async function fetchMessages(period: string): Promise<ArenaMessage[] | null> {
  try {
    const res = await fetch(`/api/fundraiser/arena/${period}/messages`, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { messages?: ArenaMessage[] }
    return data.messages ?? null
  } catch {
    return null
  }
}

export function PlayableArena({ snapshot: initial }: { snapshot: ArenaSnapshot }) {
  const { snapshot, status, staleness } = useArenaState(initial)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [player, setPlayer] = useState<Position>({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 })
  const [stageScale, setStageScale] = useState(1)
  const [messages, setMessages] = useState<ArenaMessage[]>([])
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const { status: authStatus } = useSession()
  const signedIn = authStatus === 'authenticated'
  const [sound, setSound] = useState(true)
  const [music, setMusic] = useState(false)
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([])
  const previousRef = useRef<ArenaSnapshot>(initial)
  const playSound = useArenaAudio(sound)

  const positions = useMemo(() => {
    const map = new Map<string, Position>()
    snapshot.teams.forEach((team, index) => {
      map.set(team.id, teamPosition(team, index, snapshot.teams.length))
    })
    return map
  }, [snapshot.teams])

  const selectedTeam = nearestTeam(snapshot.teams, positions, player)
  const healthy = status === 'ok' && staleness < 10_000

  useEffect(() => {
    let cancelled = false
    async function poll() {
      const next = await fetchMessages(initial.period)
      if (!cancelled && next) setMessages(next)
    }
    poll()
    const timer = window.setInterval(poll, MESSAGE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [initial.period])

  useEffect(() => {
    const node = stageRef.current
    if (!node) return

    function updateScale() {
      if (!node) return
      const rect = node.getBoundingClientRect()
      setStageScale(Math.min(rect.width / ARENA_WIDTH, rect.height / ARENA_HEIGHT))
    }

    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      const movement: Record<string, Position> = {
        arrowup: { x: 0, y: -MOVE_STEP },
        w: { x: 0, y: -MOVE_STEP },
        arrowdown: { x: 0, y: MOVE_STEP },
        s: { x: 0, y: MOVE_STEP },
        arrowleft: { x: -MOVE_STEP, y: 0 },
        a: { x: -MOVE_STEP, y: 0 },
        arrowright: { x: MOVE_STEP, y: 0 },
        d: { x: MOVE_STEP, y: 0 },
      }
      const delta = movement[key]
      if (!delta) return
      event.preventDefault()
      setPlayer((prev) => ({
        x: clamp(prev.x + delta.x, 36, ARENA_WIDTH - 36),
        y: clamp(prev.y + delta.y, 44, ARENA_HEIGHT - 44),
      }))
      playSound('step')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playSound])

  useEffect(() => {
    const previous = previousRef.current
    const previousTeams = new Map(previous.teams.map((team) => [team.id, team]))
    const attacker =
      snapshot.teams.find((team) => {
        const before = previousTeams.get(team.id)
        return before && team.salesCount > before.salesCount
      }) ?? null

    const nextEvents: DamageEvent[] = []
    for (const team of snapshot.teams) {
      const before = previousTeams.get(team.id)
      if (!before || team.hpCurrent >= before.hpCurrent) continue
      nextEvents.push({
        id: `${team.id}:${Date.now()}:${before.hpCurrent - team.hpCurrent}`,
        attackerId: attacker?.id ?? null,
        targetId: team.id,
        amount: before.hpCurrent - team.hpCurrent,
        createdAt: Date.now(),
      })
    }

    if (nextEvents.length > 0) {
      setDamageEvents((events) => [...events, ...nextEvents])
      playSound(attacker ? 'purchase' : 'hit')
    }
    previousRef.current = snapshot
  }, [snapshot, playSound])

  useEffect(() => {
    if (damageEvents.length === 0) return
    const timer = window.setTimeout(() => {
      const cutoff = Date.now() - 1800
      setDamageEvents((events) => events.filter((event) => event.createdAt > cutoff))
    }, 1900)
    return () => window.clearTimeout(timer)
  }, [damageEvents])

  useEffect(() => {
    if (!music || !sound) return
    const timer = window.setInterval(() => playSound('message'), 1800)
    return () => window.clearInterval(timer)
  }, [music, playSound, sound])

  async function addMessage() {
    const body = safeMessage(message)
    if (!body || posting) return
    setPosting(true)
    setPostError(null)
    try {
      const res = await fetch(`/api/fundraiser/arena/${initial.period}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, teamId: selectedTeam?.id ?? null }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: ArenaMessage
      }
      if (!res.ok || !data.message) {
        setPostError(data.error ?? 'Could not post message')
        return
      }
      const posted = data.message
      setMessages((prev) => [posted, ...prev.filter((m) => m.id !== posted.id)])
      setMessage('')
      playSound('message')
    } catch {
      setPostError('Could not reach the arena. Check your connection and try again.')
    } finally {
      setPosting(false)
    }
  }

  // Bubbles sit above the team's camp; messages without a team float mid-arena.
  function messagePosition(item: ArenaMessage, index: number): Position {
    const camp = item.teamId ? positions.get(item.teamId) : undefined
    if (camp) return { x: camp.x, y: camp.y - 70 }
    return { x: ARENA_WIDTH / 2 + ((index % 3) - 1) * 200, y: 90 + Math.floor(index / 3) * 70 }
  }

  function moveBy(delta: Position) {
    setPlayer((prev) => ({
      x: clamp(prev.x + delta.x, 36, ARENA_WIDTH - 36),
      y: clamp(prev.y + delta.y, 44, ARENA_HEIGHT - 44),
    }))
    playSound('step')
  }

  return (
    <section className="space-y-6">
      <div
        className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-full border border-neutral-800 bg-black/70 px-3 py-1 font-mono text-[10px] uppercase tracking-widest backdrop-blur"
        aria-live="polite"
      >
        <span
          className={clsx(
            'h-2 w-2 rounded-full',
            healthy
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
              : status === 'error'
                ? 'bg-red-500'
                : 'animate-pulse bg-amber-400',
          )}
        />
        <span className="text-neutral-400">
          {healthy ? 'LIVE' : status === 'error' ? 'RETRY' : 'SYNC'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-lg border border-amber-500/25 bg-[#0b0906] shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 bg-black/45 px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
              <Gamepad2 className="h-4 w-4" />
              Playable Arena
            </div>
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  'rounded px-2 py-1 font-mono text-[10px] uppercase tracking-widest',
                  healthy ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300',
                )}
              >
                Status {healthy ? 'LIVE' : status === 'error' ? 'RETRY' : 'SYNC'}
              </span>
              <button
                type="button"
                onClick={() => setSound((value) => !value)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-700 bg-black/40 text-slate-200 hover:border-amber-300 hover:text-amber-200"
                aria-label={sound ? 'Mute arena sounds' : 'Enable arena sounds'}
              >
                {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={() => setMusic((value) => !value)}
                className="inline-flex h-8 w-8 items-center justify-center rounded border border-neutral-700 bg-black/40 text-slate-200 hover:border-amber-300 hover:text-amber-200"
                aria-label={music ? 'Stop arena pulse' : 'Start arena pulse'}
              >
                {music ? <Music2 className="h-4 w-4" /> : <Music className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div ref={stageRef} className="relative aspect-[5/3] min-h-[420px] w-full overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(245,158,11,0.22),transparent_32%),linear-gradient(135deg,#172016_0%,#0b1117_48%,#221106_100%)]">
            <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:48px_48px]" />
            <div className="absolute left-1/2 top-1/2 h-[58%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 border-dashed border-amber-300/20" />
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: ARENA_WIDTH,
                height: ARENA_HEIGHT,
                transform: `translate(-50%, -50%) scale(${stageScale})`,
                transformOrigin: 'center',
              }}
            >
              {snapshot.teams.map((team) => {
                const pos = positions.get(team.id)
                if (!pos) return null
                return (
                  <TeamActor
                    key={team.id}
                    team={team}
                    position={pos}
                    selected={selectedTeam?.id === team.id}
                    damaged={damageEvents.some((event) => event.targetId === team.id)}
                  />
                )
              })}

              <AnimatePresence>
                {messages.map((item, index) => {
                  const pos = messagePosition(item, index)
                  return (
                  <motion.div
                    key={item.id}
                    className="absolute max-w-[190px] rounded border border-amber-200/40 bg-black/80 px-3 py-2 text-xs text-amber-50 shadow-xl"
                    style={{ left: pos.x - 88, top: pos.y - 38 }}
                    initial={{ opacity: 0, y: 14, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="truncate font-bold text-amber-300">{item.author}</div>
                    <div className="break-words">{item.body}</div>
                  </motion.div>
                  )
                })}
              </AnimatePresence>

              <motion.div
                className="absolute z-20"
                style={{ left: player.x - PLAYER_SIZE / 2, top: player.y - PLAYER_SIZE / 2, width: PLAYER_SIZE }}
                animate={{ x: 0, y: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              >
                <PixelSprite isPlayer />
                <div className="mt-1 rounded bg-amber-300 px-1 text-center text-[9px] font-black uppercase text-slate-950">
                  You
                </div>
              </motion.div>

              <DamageLayer events={damageEvents} positions={positions} />
            </div>
          </div>
        </div>

        <aside className="rounded-lg border border-neutral-800 bg-black/45 p-4 text-white">
          <div className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
                <MessageSquare className="h-4 w-4" />
                Interact
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {selectedTeam
                  ? `${selectedTeam.name} is nearby. Purchases are the only way attacks happen.`
                  : 'Move near a team to post a message at their camp.'}
              </p>
            </div>

            {selectedTeam && (
              <div className="rounded border border-neutral-800 bg-neutral-950/80 p-3">
                <div className="truncate font-semibold">{selectedTeam.name}</div>
                <div className="text-xs uppercase tracking-widest text-neutral-500">
                  {selectedTeam.school}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-neutral-500">Raised</div>
                    <div className="font-mono text-emerald-300">
                      {formatCurrency(selectedTeam.raised)}
                    </div>
                  </div>
                  <div>
                    <div className="text-neutral-500">HP</div>
                    <div className="font-mono text-amber-200">
                      {selectedTeam.hpCurrent}/{selectedTeam.hpMax}
                    </div>
                  </div>
                </div>
                <a
                  href={`/fundraise/${selectedTeam.slug}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded bg-amber-300 px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-200"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Support team
                </a>
              </div>
            )}

            {signedIn ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400" htmlFor="arena-message">
                Message
              </label>
              <textarea
                id="arena-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="min-h-20 w-full resize-none rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-300"
                maxLength={120}
              />
              <button
                type="button"
                onClick={addMessage}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-white px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!safeMessage(message) || posting}
              >
                <Send className="h-4 w-4" />
                {posting ? 'Posting…' : 'Leave message'}
              </button>
              {postError && <p className="text-xs text-rose-300">{postError}</p>}
            </div>
            ) : (
              <a
                href={`/auth/signin?callbackUrl=${encodeURIComponent(`/arena/${initial.period}`)}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded bg-white px-3 py-2 text-sm font-bold text-slate-950 hover:bg-amber-100"
              >
                Sign in to leave a message
              </a>
            )}

            <div className="grid grid-cols-3 gap-2 sm:hidden">
              <span />
              <button type="button" onClick={() => moveBy({ x: 0, y: -MOVE_STEP })} className="rounded border border-neutral-700 py-2">Up</button>
              <span />
              <button type="button" onClick={() => moveBy({ x: -MOVE_STEP, y: 0 })} className="rounded border border-neutral-700 py-2">Left</button>
              <button type="button" onClick={() => moveBy({ x: 0, y: MOVE_STEP })} className="rounded border border-neutral-700 py-2">Down</button>
              <button type="button" onClick={() => moveBy({ x: MOVE_STEP, y: 0 })} className="rounded border border-neutral-700 py-2">Right</button>
            </div>
          </div>
        </aside>
      </div>

      <LeaderboardTable teams={snapshot.teams} />
    </section>
  )
}
