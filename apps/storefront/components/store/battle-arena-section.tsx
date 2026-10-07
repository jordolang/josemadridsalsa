import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  Crown,
  Film,
  Flame,
  Gamepad2,
  Globe,
  HeartHandshake,
  MessageCircle,
  Shirt,
  Swords,
  Trophy,
  Wand2,
  type LucideIcon,
} from 'lucide-react'
import { ScrollReveal } from '@/components/ui/scroll-reveal'
import { BattleLiveBadge } from '@/components/store/battle-live-nav-link'
import { BATTLE_ARENA_URL } from '@/lib/arena-game/links'

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Swords,
    title: 'Up to 8 fighters',
    body: 'An open-field 3D brawler. Everyone drops into the arena and the last one standing takes the round.',
  },
  {
    icon: Globe,
    title: 'Online in seconds',
    body: 'Join the 30-second public queue, open a private room, or send friends an invite code. CPUs fill any empty spots.',
  },
  {
    icon: Trophy,
    title: 'Ranked and party modes',
    body: 'Ranked 1v1, 2v2 duos, King of the Hill and an Arcade ladder that ends in a boss fight.',
  },
  {
    icon: Crown,
    title: 'Fundraiser tournaments',
    body: 'Groups go head to head in bracket tournaments with spectators and live chat.',
  },
  {
    icon: Wand2,
    title: 'Gear, guns and spells',
    body: 'Pick up weapons and armor, then fire off abilities from a hotkey bar mid-fight.',
  },
  {
    icon: Shirt,
    title: 'Build your fighter',
    body: 'Choose a fighter and customize their build, outfit and colors.',
  },
  {
    icon: Flame,
    title: 'Hazard arenas',
    body: 'Fight on the Sky Bridge, in the Foundry or inside the Eye of the Storm, each with traps of its own.',
  },
  {
    icon: BarChart3,
    title: 'Leaderboards and profiles',
    body: 'Sign in with your José Madrid Salsa account to track wins and streaks and climb the weekly boards.',
  },
  {
    icon: Gamepad2,
    title: 'Play your way',
    body: 'Keyboard, game controller or touch screen. A tutorial and practice room get new players ready fast.',
  },
  {
    icon: MessageCircle,
    title: 'Friends and emotes',
    body: 'Add friends, see who is online, and taunt with emotes and quick chat.',
  },
  {
    icon: Film,
    title: 'Replays and sharing',
    body: 'Watch the fight back and share your win to Facebook in one tap.',
  },
  {
    icon: HeartHandshake,
    title: 'Every jar counts',
    body: 'Fight for your fundraising group. When the group hits its goal, its fighters earn a Silver Laurel or Golden Crown.',
  },
]

interface BattleArenaSectionProps {
  heading?: string
  body?: string
}

/** Homepage feature block for the José Madrid Salsa Battle Arena game. */
export function BattleArenaSection({ heading, body }: BattleArenaSectionProps) {
  return (
    <section className="relative overflow-hidden bg-stone-950 py-12 text-white sm:py-16 md:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-salsa-600/25 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-chile-300">
                  Free to play in your browser
                </span>
                <BattleLiveBadge />
              </div>
              <h2 className="mb-4 font-serif text-3xl font-bold leading-tight tracking-[-0.02em] sm:text-4xl md:text-5xl">
                {heading || (
                  <>
                    Enter the <span className="text-gradient">Battle Arena</span>
                  </>
                )}
              </h2>
              <p className="mb-7 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                {body ||
                  'Our own 3D fighting game. Brawl with up to eight fighters, team up with your fundraising group, and battle your way up the leaderboards.'}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={BATTLE_ARENA_URL}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-full bg-salsa-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-salsa-600 hover:shadow-[0_4px_12px_rgba(229,62,62,0.4)]"
                >
                  Play Now
                  <ArrowRight className="h-4 w-4" />
                </a>
                <Link
                  href="/fundraising"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-white/40"
                >
                  Start a Fundraiser
                </Link>
              </div>
              <p className="mt-4 text-sm text-white/60">
                Players fight for a fundraising group, so join one or start your own before your first match.
              </p>
            </div>

            <div className="relative">
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                <Image
                  src="/images/battle-arena/eight-fighter-brawl.webp"
                  alt="Eight fighters squaring off in the Battle Arena"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="absolute -bottom-6 -left-4 w-24 sm:w-32 lg:-left-8 lg:w-36">
                <Image
                  src="/images/battle-arena/battle-arena-crest.webp"
                  alt="José Madrid Salsa Battle Arena crest"
                  width={560}
                  height={560}
                  className="h-auto w-full drop-shadow-2xl"
                  sizes="144px"
                />
              </div>
            </div>
          </div>
        </ScrollReveal>

        <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, idx) => (
            <ScrollReveal key={feature.title} delay={40 * (idx % 3)}>
              <div className="flex h-full items-start gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-5">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-salsa-500/15 text-salsa-400">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h3 className="mb-1 font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/70">{feature.body}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
