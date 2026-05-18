import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star, Flame, Users, Award } from "lucide-react";

export function HomeHero() {
  return (
    <section
      className="relative overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(ellipse at 65% 45%, #6b3a10 0%, #3a1c05 35%, #1a0c02 70%, #110800 100%)",
      }}
    >
      {/* Warm amber glow behind image area */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-full w-[55%]"
        style={{
          background:
            "radial-gradient(ellipse at 55% 45%, rgba(160, 80, 10, 0.55) 0%, transparent 65%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid min-h-[78vh] grid-cols-1 items-center lg:grid-cols-2">
          {/* ── Left: copy ── */}
          <div className="z-10 py-20 lg:py-28">
            {/* Badge */}
            <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-amber-500/60 px-4 py-1.5 text-xs font-semibold tracking-wider text-amber-400">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              Award-Winning Since 1987
            </span>

            {/* Heading */}
            <h1 className="mb-4 font-serif font-black uppercase leading-[0.9] tracking-tight">
              <span className="block text-[clamp(3rem,6vw,5.5rem)] text-white">Premium</span>
              <span className="block text-[clamp(3rem,6vw,5.5rem)] text-white">Gourmet</span>
              <span className="block text-[clamp(3rem,6vw,5.5rem)] text-amber-500">Salsa</span>
            </h1>

            {/* Divider */}
            <div className="mb-5 h-px w-20 bg-amber-500/50" />

            {/* Body */}
            <p className="mb-8 max-w-[22rem] text-base leading-relaxed text-white/75">
              Made with the finest ingredients in Ohio. From mild to fiery hot,
              discover the perfect salsa for every taste — handcrafted in small batches.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-black shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-amber-400 hover:shadow-[0_6px_20px_rgba(245,158,11,0.4)]"
              >
                Shop Salsas
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/our-story"
                className="inline-flex items-center gap-2 rounded-full border border-amber-700/60 bg-transparent px-7 py-3.5 text-sm font-bold uppercase tracking-widest text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-500/80 hover:bg-white/5"
              >
                Our Story
              </Link>
            </div>
          </div>

          {/* ── Right: founder image ── */}
          <div className="pointer-events-none relative -mr-4 self-end sm:-mr-6 lg:-mr-8">
            <div className="relative h-[520px] w-full lg:h-[640px]">
              <Image
                src="/images/shared/Hero-Image-Mike.png"
                alt="Mike Zakany, founder of Jose Madrid Salsa"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 55vw"
                className="object-contain object-bottom"
              />
            </div>
          </div>
        </div>

        {/* ── Stat bar ── */}
        <div
          className="relative z-10 mb-8 rounded-2xl border border-amber-900/30 px-6 py-5"
          style={{ background: "rgba(18, 9, 1, 0.88)" }}
        >
          <div className="grid grid-cols-3 divide-x divide-amber-900/30">
            {/* Flavors */}
            <div className="flex items-center justify-center gap-3 px-4 sm:px-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-700/50 text-amber-500">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-2xl font-bold leading-none text-amber-500">25+</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Flavors
                </div>
              </div>
            </div>

            {/* Fundraisers */}
            <div className="flex items-center justify-center gap-3 px-4 sm:px-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-700/50 text-amber-500">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-2xl font-bold leading-none text-amber-500">500+</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Fundraisers
                </div>
              </div>
            </div>

            {/* Years */}
            <div className="flex items-center justify-center gap-3 px-4 sm:px-6">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-amber-700/50 text-amber-500">
                <Award className="h-5 w-5" />
              </div>
              <div>
                <div className="font-serif text-2xl font-bold leading-none text-amber-500">35+</div>
                <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-white/50">
                  Years
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
