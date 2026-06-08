import Image from "next/image";
import Link from "next/link";

export function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate min-h-[calc(100svh-8rem)] overflow-hidden bg-[#070503] text-white md:aspect-[1536/871] md:min-h-0"
    >
      <Image
        src="/images/home/jose-madrid-home-hero-reference.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[68%_center] md:object-center"
      />

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-black/10 md:hidden"
      />

      <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-8 md:sr-only">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#e0ae4f]">
          Award-winning since 1987
        </p>
        <h1
          id="home-hero-title"
          className="max-w-[9ch] font-serif text-5xl font-bold leading-[0.94] text-white"
        >
          Premium Gourmet <span className="text-[#e0ae4f]">Salsa</span>
        </h1>
        <p>
          <Link
            href="/products"
            className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#d9a235] px-7 py-3 text-sm font-bold uppercase tracking-wide text-[#140d06] shadow-lg transition-colors hover:bg-[#e6b54e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Shop salsas
          </Link>
        </p>
      </div>

      <div className="sr-only md:block">
        <p>Award-winning since 1987</p>
        <h1>Premium Gourmet Salsa</h1>
        <p>
          Made with the finest ingredients in Ohio. From mild to fiery hot,
          discover the perfect salsa for every taste, handcrafted in small
          batches.
        </p>
        <p>25+ flavors, 500+ fundraisers, and 35+ years.</p>
      </div>

      <Link
        href="/products"
        aria-label="Shop salsas"
        className="absolute left-[4.3%] top-[70%] z-10 hidden h-[6.8%] w-[16.7%] min-w-[160px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a235] md:block"
      />
      <Link
        href="/our-story"
        aria-label="Read our story"
        className="absolute left-[22.6%] top-[70%] z-10 hidden h-[6.8%] w-[12.7%] min-w-[128px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a235] md:block"
      />
    </section>
  );
}
