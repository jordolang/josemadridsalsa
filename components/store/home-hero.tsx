import Image from "next/image";
import Link from "next/link";

export function HomeHero() {
  return (
    <section
      aria-labelledby="home-hero-title"
      className="relative isolate aspect-[1536/871] overflow-hidden bg-[#070503] text-white"
    >
      <Image
        src="/images/home/jose-madrid-home-hero-reference.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="sr-only">
        <p>Award-winning since 1987</p>
        <h1 id="home-hero-title">Premium Gourmet Salsa</h1>
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
        className="absolute left-[4.3%] top-[70%] z-10 h-[6.8%] w-[16.7%] min-w-[160px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a235]"
      />
      <Link
        href="/our-story"
        aria-label="Read our story"
        className="absolute left-[22.6%] top-[70%] z-10 h-[6.8%] w-[12.7%] min-w-[128px] rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d9a235]"
      />
    </section>
  );
}
