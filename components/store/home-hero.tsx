import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

interface HomeHeroStat {
  value: string;
  label: string;
}

const STATS: HomeHeroStat[] = [
  { value: "25+", label: "Flavors" },
  { value: "500+", label: "Fundraisers" },
  { value: "35+", label: "Years" },
];

export function HomeHero() {
  return (
    <section className="hero-gradient relative overflow-hidden text-white">
      {/* Legibility overlay */}
      <div aria-hidden className="absolute inset-0 bg-black/20" />

      {/* Floating blur circles — signature kit texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 top-20 h-32 w-32 rounded-full bg-white/10 blur-2xl animate-bounce-gentle"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-10 h-24 w-24 rounded-full bg-white/10 blur-xl animate-bounce-gentle animation-delay-400"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/3 top-1/3 h-16 w-16 rounded-full bg-white/10 blur-lg animate-bounce-gentle animation-delay-600"
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28 lg:px-8">
        {/* Copy */}
        <div className="animate-slide-up">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
            <Star className="h-3 w-3 fill-current" />
            Award-Winning Since 1987
          </span>
          <h1
            className="mb-5 font-serif text-5xl font-bold leading-[0.95] tracking-[-0.02em] md:text-6xl lg:text-7xl"
          >
            Premium Gourmet
            <span className="block italic text-chile-200">Salsa</span>
          </h1>
          <p className="mb-7 max-w-md text-lg leading-relaxed text-white/90 md:text-xl">
            Made with the finest ingredients in Ohio. From mild to fiery hot,
            discover the perfect salsa for every taste — handcrafted in small batches.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-salsa-600 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-stone-100 hover:shadow-xl"
            >
              Shop Salsas
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/our-story"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-base font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20"
            >
              Our Story
            </Link>
          </div>

          {/* Stat strip — Volkhov numerals, hairline divider */}
          <dl className="mt-10 flex gap-8 border-t border-white/20 pt-6">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-serif text-3xl font-bold">{stat.value}</dd>
                <p className="mt-0.5 text-xs uppercase tracking-wider text-white/80">
                  {stat.label}
                </p>
              </div>
            ))}
          </dl>
        </div>

        {/* Founder photo with floating badge */}
        <div className="relative animate-slide-up animation-delay-200">
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl shadow-2xl">
            <Image
              src="/images/shared/Hero-Image-Mike.png"
              alt="Mike Zakany, founder of Jose Madrid Salsa"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="object-cover object-center"
            />
          </div>
          <div className="absolute -bottom-3 -left-3 flex items-center gap-2.5 rounded-2xl bg-white p-3 text-foreground shadow-xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-chile-100 text-xl">
              🌶️
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold">Mike Zakany</div>
              <div className="text-[10px] text-muted-foreground">Founder &amp; Chef</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
