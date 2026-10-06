import type { Metadata } from 'next'
import { PageHero } from '../_components/page-hero'
import { YouTubeEmbed } from '../_components/youtube-embed'

export const metadata: Metadata = {
  title: 'Our Story',
  description:
    'From Zak’s Restaurant in 1976 to José Madrid Salsa in 1987: how a Zanesville, Ohio family turned its New Mexico heritage into a line of salsas.',
  alternates: { canonical: '/our-story' },
}

const STORY = [
  'In 1976, Mike Zakany and his brother opened Zak’s Restaurant in downtown Zanesville, Ohio. The contemporary casual restaurant was a welcome addition to the small urban center and was successful from the beginning. The family’s Mexican heritage made the emerging ethnic food market a natural niche, and Estelle Zakany, the family matriarch, helped her sons bring more authentic Mexican cuisine into the menu and life of the restaurant.',
  'The Zakanys have always been entrepreneurs. Mike’s paternal grandparents opened a butcher shop and grocery store in Zanesville in 1942, and the whole family worked hard to grow it over the years. The restaurant was a natural extension of that love for the food business, and it quickly built a loyal clientele. People loved the “New Mexico” style food, and booming carry-out and dining room sales confirmed the niche.',
  'Salsa was a key part of the menu — it enhanced the flavors of every dish — and demand kept growing. So Mike set out to develop his own. He studied all kinds of spices and chili peppers, and read with great interest about the Spaniards who migrated to Mexico and how America’s native peoples influenced their cuisine.',
  'Mike kept refining the recipes, with restaurant customers serving as the critics. Eventually the favorite blend of spices, chili peppers and herbs emerged, shaped by the cooking culture of his maternal grandfather. In 1987, José Madrid Salsa became a reality, named after that beloved grandfather from Clovis, New Mexico.',
  'José was larger than life: he could ride a horse and shoot better than anyone in the unsettled New Mexico Territory of the early 1900s, and he was the reason the family gathered in Clovis for summer vacations and reunions. He was the perfect namesake for a New Mexico style salsa.',
  'José Madrid Salsa made its first sales in gourmet and grocery stores during the 1988 Christmas season. The legend of José Madrid lives on and keeps growing, with dozens of salsas and more in development.',
] as const

export default function OurStoryPage() {
  return (
    <>
      <PageHero eyebrow="Our story" title="A family recipe from Zanesville, Ohio" />

      <section className="py-14">
        <div className="container mx-auto max-w-3xl px-4">
          <YouTubeEmbed videoId="RSdphE7JocU" title="The story of Jose Madrid Salsa" />
          <div className="mt-10 space-y-5 text-lg leading-relaxed text-foreground/90">
            {STORY.map((paragraph) => (
              <p key={paragraph.slice(0, 32)}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-10 text-center font-serif text-2xl font-bold italic text-salsa-600">¡Es la verdad!</p>
        </div>
      </section>
    </>
  )
}
