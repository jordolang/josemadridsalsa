import Image from 'next/image'
import { Gamepad2 } from 'lucide-react'

/**
 * The arena's playable game: the 3D Battle Arena at /battle-arena. It opens on its own page,
 * full screen, because it signs players in through the main site and plays best with the
 * whole screen. Results it reports land on the main site's player leaderboards.
 */
export function BattleArenaGame() {
  return (
    <div className="grid overflow-hidden rounded-lg border border-amber-500/25 bg-[#0b0906] shadow-2xl md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /battle-arena is a static page (public/battle-arena), not a route <Link> can render */}
      <a href="/battle-arena" className="relative block aspect-[1200/630]" aria-label="Play the Battle Arena">
        <Image
          src="/battle-arena/og-image.jpg"
          alt="José Madrid Salsa Battle Arena crest over a fight in the coliseum"
          fill
          sizes="(min-width: 768px) 55vw, 100vw"
          className="object-cover"
          priority
        />
      </a>
      <div className="flex flex-col justify-center gap-4 p-5 sm:p-8">
        <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-amber-300">
          <Gamepad2 className="h-4 w-4" />
          Play the Battle Arena
        </div>
        <p className="text-sm text-slate-300 sm:text-base">
          Up to eight fighters in a 3D coliseum, last one standing wins. Fight the computer or your
          friends online, with a keyboard, a controller or your phone&apos;s touch screen.
        </p>
        <p className="text-sm text-slate-400">
          Sign in with your José Madrid Salsa account and pick your fundraising group. Your wins and
          knockouts count on the player leaderboards.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a static page, as above */}
        <a
          href="/battle-arena"
          className="inline-flex w-full items-center justify-center gap-2 rounded bg-amber-300 px-4 py-3 text-base font-bold text-slate-950 hover:bg-amber-200 sm:w-auto sm:self-start"
        >
          <Gamepad2 className="h-5 w-5" />
          Play now
        </a>
      </div>
    </div>
  )
}
