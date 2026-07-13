import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SHARED_HERO = '/images/shared/jose-madrid-building.jpeg'
const LOGO_FALLBACK = '/images/shared/jose-madrid-salsa-logo.png'
const BOWL = '/images/shared/salsa-bowl.png'
const MIKE = '/images/shared/Hero-Image-Mike.png'

interface CategorySeed {
  slug: string
  name: string
  description: string
  accentColor: string
  sortOrder: number
}

const CATEGORIES: CategorySeed[] = [
  {
    slug: 'road-notes',
    name: 'Road Notes',
    description: "Dispatches from the road. Where Jose is, who we met, what we ate.",
    accentColor: '#c0392b',
    sortOrder: 1,
  },
  {
    slug: 'salsa-lore',
    name: 'Salsa Lore',
    description: 'The history, family stories, and traditions behind every jar.',
    accentColor: '#8e44ad',
    sortOrder: 2,
  },
  {
    slug: 'from-the-kitchen',
    name: 'From the Kitchen',
    description: 'Recipes, pairings, and cooking notes built around our salsas.',
    accentColor: '#16a085',
    sortOrder: 3,
  },
  {
    slug: 'behind-the-jar',
    name: 'Behind the Jar',
    description: 'How we make it, who makes it, and the craft that keeps us small.',
    accentColor: '#d35400',
    sortOrder: 4,
  },
]

interface SeriesSeed {
  slug: string
  name: string
  tagline: string
  description: string
  accentColor: string
  isFeatured: boolean
  sortOrder: number
}

const SERIES: SeriesSeed[] = [
  {
    slug: 'where-is-jose',
    name: 'Where is Jose?',
    tagline: 'Following the salsa across America, one festival at a time.',
    description:
      'A running travelogue of every event, festival, farmers market, and roadside tasting where Jose Madrid Salsa shows up. Real places, real people, real heat.',
    accentColor: '#c0392b',
    isFeatured: true,
    sortOrder: 1,
  },
  {
    slug: 'family-recipes',
    name: 'Family Recipes',
    tagline: 'The recipes that built Jose Madrid Salsa, one story at a time.',
    description:
      'Recipes passed down from Clovis, New Mexico to Zanesville, Ohio. The dishes our family cooks at home, told the way our family tells them.',
    accentColor: '#16a085',
    isFeatured: true,
    sortOrder: 2,
  },
]

interface PostSeed {
  slug: string
  title: string
  subtitle?: string
  excerpt: string
  content: string
  coverImage: string
  coverImageAlt: string
  categorySlug: string
  seriesSlug?: string
  seriesOrder?: number
  tags: string[]
  featured: boolean
  readingMinutes: number
  daysAgo: number
}

const POSTS: PostSeed[] = [
  {
    slug: 'the-zanesville-y-bridge-tasting',
    title: 'The Y-Bridge Tasting',
    subtitle: 'Three flavors, two hours, one very confused tourist',
    excerpt:
      "We set up a tasting table at the foot of Zanesville's famous Y-Bridge. Here's what 184 strangers taught us about heat tolerance, regional palates, and the strange social ritual of trying a stranger's salsa.",
    content: `# The Y-Bridge Tasting

We set up a folding table at the foot of the Y-Bridge on a Saturday in October. Three salsas: **Black Bean & Corn**, **Cilantro Green Olive**, and **Raspberry BBQ Chipotle**. A stack of tortilla chips, a sharpie, and a notebook.

By 4 p.m. we had handed out **184 tastings**. Here is what we learned.

## The hesitation is always the same

Almost everyone does the same three things in the same order:

1. They glance at the table.
2. They pretend not to.
3. They circle back.

The circle-back is where the magic happens. It's the moment a person decides that *trying a stranger's salsa* is a thing they are willing to do today. That decision is everything. The recipe never had to be perfect — the *invitation* did.

## Raspberry was the surprise

We expected **Black Bean & Corn** to win the day. It's our most-shipped flavor and it's the safest bet. We were wrong.

Out of 184 people, **97** asked to buy a jar of the Raspberry BBQ Chipotle on the spot. Black Bean came in second at 64.

The takeaway: when people *can* taste before they buy, they get bolder. They reach for the weird one.

## A note on the tourist

One woman drove down from Cleveland, parked in the wrong lot, walked across the bridge in the wrong direction, ended up at our table by accident, tasted all three, bought four jars, and asked us where the bridge was.

She was standing on it.

That's Zanesville for you.

---

*Catch us at the next event — see the [Where is Jose](/where-is-jose) page for the full calendar.*`,
    coverImage: SHARED_HERO,
    coverImageAlt: 'Jose Madrid Salsa retail building',
    categorySlug: 'road-notes',
    seriesSlug: 'where-is-jose',
    seriesOrder: 1,
    tags: ['zanesville', 'tasting', 'event'],
    featured: true,
    readingMinutes: 4,
    daysAgo: 2,
  },
  {
    slug: 'how-clovis-made-our-cilantro-green-olive',
    title: 'How Clovis, New Mexico Made Our Cilantro Green Olive',
    subtitle: "A grandmother's pantry, a bowl on the porch, and the flavor that travelled 1,400 miles east",
    excerpt:
      "Cilantro Green Olive isn't a marketing flavor. It's a recipe my grandmother kept in her head, made in a green ceramic bowl on a porch in Clovis, New Mexico. This is how it got into a jar.",
    content: `# How Clovis, New Mexico Made Our Cilantro Green Olive

People ask where the **Cilantro Green Olive** recipe comes from like they expect a marketing answer — a focus group, a test kitchen, a chef in a white coat with a clipboard.

The real answer is **a green ceramic bowl on a porch in Clovis, New Mexico**, sometime in the late seventies. My grandmother made it on Sunday afternoons because the olives were cheap, the cilantro was loud, and the heat from the day made everything taste sharper.

## What goes in (the way she told it)

She never measured. The recipe, as she'd describe it, went like this:

> "A handful of cilantro, *un poquito más* than you think. The good olives, the ones in the jar with the pimento, drained but not *too* drained. Some onion — chop it finer than you want to. A jalapeño if the kids aren't around, two if they are. Salt. Tomato if the tomato is good. If not, don't bother."

That's it. That's the recipe.

## Why it travelled

It travelled with my dad when he left Clovis. It travelled to **Zanesville, Ohio**, when the family business started in 1986. It went into the rotation because customers kept asking *what is that one* — the green one, with the olives, that doesn't taste like anything else.

We never changed it. The jar is the porch.

## The one thing we did add

We taste-tested the green olives. Different brands, different brines. We landed on the Spanish manzanilla because it has more bite. My grandmother would have called this *fancy.* She would have eaten it anyway.

---

*The Cilantro Green Olive is one of [our originals](/products?heat=mild). One jar = roughly four porch afternoons.*`,
    coverImage: BOWL,
    coverImageAlt: 'A bowl of fresh salsa',
    categorySlug: 'salsa-lore',
    seriesSlug: 'family-recipes',
    seriesOrder: 1,
    tags: ['clovis', 'recipe-history', 'cilantro-green-olive'],
    featured: true,
    readingMinutes: 5,
    daysAgo: 6,
  },
  {
    slug: 'sheet-pan-chicken-with-raspberry-chipotle',
    title: 'Sheet-Pan Chicken With Raspberry Chipotle, in 35 Minutes',
    subtitle: 'A weeknight dinner that earns the jar in the fridge',
    excerpt:
      'The Raspberry BBQ Chipotle is not a chip-and-dip salsa. It is a glaze. Here is the one weeknight recipe that turned a flavor experiment into our most-asked-for jar.',
    content: `# Sheet-Pan Chicken With Raspberry Chipotle, in 35 Minutes

If you only ever scoop a chip into the **Raspberry BBQ Chipotle**, you are using maybe 30% of its life. The remaining 70% is glaze.

This is the recipe we send people who buy a jar and ask, *"...and now what?"*

## The recipe

**Serves 4 · 35 minutes total · One sheet pan**

### What you need

- 1.5 lb bone-in, skin-on chicken thighs (4–6 pieces)
- 1 large red onion, cut into wedges
- 2 cups broccoli florets
- 2 tbsp olive oil
- ½ tsp kosher salt
- ¼ tsp black pepper
- **¾ cup Jose Madrid Raspberry BBQ Chipotle**, divided

### What you do

1. **Preheat** oven to 425°F.
2. **Toss** chicken, onion, and broccoli on a sheet pan with olive oil, salt, and pepper. Push the chicken to one side so it doesn't steam the veg.
3. **Roast 20 minutes.**
4. **Glaze.** Pull the pan. Brush the chicken with **½ cup** of the Raspberry BBQ Chipotle, generously. Return to the oven for **10–12 minutes**, until the skin is dark and crackly and the glaze has caught in spots.
5. **Finish.** Off the heat, drizzle the remaining ¼ cup over everything. Let it rest 3 minutes. Serve.

## Why it works

The chipotle does the heat. The raspberry caramelizes. The chicken skin holds the glaze in place instead of letting it puddle and burn. This is the same trick a steakhouse uses with a bourbon glaze; we just got there with a jar.

## Don't skip the final drizzle

The roasting concentrates the salsa and dulls the brightness. The cold drizzle at the end puts the *fresh* back in.

---

*Want to try it without committing? Add a [single jar](/products?heat=fruit) to your next order — or grab a [Bundle Deal](/bundles) and pair it with the Cilantro Green Olive for an A/B weeknight test.*`,
    coverImage: SHARED_HERO,
    coverImageAlt: 'Jose Madrid Salsa products',
    categorySlug: 'from-the-kitchen',
    tags: ['recipe', 'weeknight', 'raspberry-chipotle', 'sheet-pan'],
    featured: false,
    readingMinutes: 4,
    daysAgo: 11,
  },
  {
    slug: 'meet-mike-the-salsa-guy',
    title: 'Meet Mike, the Salsa Guy',
    subtitle: 'The man behind the jars, in his own words',
    excerpt:
      "If you've called the office, you've talked to Mike. If you've been to a tasting, you've met Mike. Here is the long version of who he is, why he kept the company small on purpose, and what he means when he says \"we don't ship sadness.\"",
    content: `# Meet Mike, the Salsa Guy

If you have ever called the Jose Madrid Salsa office, you talked to **Mike**.

If you have ever been to a tasting, met us at a festival, ordered a custom jar for a fundraiser, asked a weird question about heat levels, or messaged us at 11 p.m. wondering if we ship to Alaska — you talked to Mike.

He runs this place. He also packs your jars.

## The short version

> "I'm Mike. I make salsa. I do the books. I answer the phone. I'm at the festivals. I'm at the office. I'm the guy."

## The long version

Mike grew up in the family business — Jose Madrid Salsa was founded by his father in 1986 in Zanesville, Ohio, with recipes from Clovis, New Mexico. Mike's been around the kettles since he was a kid.

He has been offered, more than once, to **scale this thing up**. National grocery chain distribution. White-label deals. The whole "exit" pitch. Every time, he says no.

His reason, in his words:

> "We make a small thing. People taste it and tell us. That's the point. The minute it gets big enough that I don't know who's eating it, I lose the only thing that makes it good."

## What "we don't ship sadness" means

It's on the wall in the office. He says it about three times a week.

What he means: nothing goes out of the building that he wouldn't eat himself, that day. If a batch comes off the line and tastes flat — it doesn't ship. If a label is crooked — it doesn't ship. If a customer's reorder is missing the Hot Pineapple they always get — *especially* if it's the Hot Pineapple they always get — Mike calls.

## You'll meet him

We are at events all summer and most of the fall. The [Where is Jose](/where-is-jose) page is the schedule. Come say hi. He'll remember you.

---

*Mike is the reason this place exists. The website is the reason you can find him.*`,
    coverImage: MIKE,
    coverImageAlt: 'Mike, behind the counter at Jose Madrid Salsa',
    categorySlug: 'behind-the-jar',
    tags: ['team', 'introduction', 'zanesville'],
    featured: false,
    readingMinutes: 4,
    daysAgo: 18,
  },
  {
    slug: 'why-our-heat-scale-only-goes-to-five',
    title: 'Why Our Heat Scale Only Goes to Five',
    subtitle: 'On the lie of the 1-to-10 chili and the tyranny of "extra hot"',
    excerpt:
      "Most salsa lines run a 1-to-10 heat scale. Ours stops at 5. Not because we can't make hotter — we make plenty hot. Because the upper half of those scales is dishonest, and an honest 5 is more useful than a marketing 9.",
    content: `# Why Our Heat Scale Only Goes to Five

Walk down a salsa aisle and you'll see them: little chili icons climbing up the label. One chili. Three. Seven. *Nine.* "Extra Hot" in a flame-shaped sticker.

Almost all of it is marketing.

Here is why our scale only goes to **five**.

## A heat scale should mean something

When we say a salsa is a **3**, we mean: *you will notice the heat. You will not be in pain. You will eat the whole bowl.*

When we say a salsa is a **5**, we mean: *you have committed to this. You are not snacking. You will sweat. This is the point.*

There is no honest **9**. A 9 on most labels is just a 5 with a different sticker, or it's a 12 that nobody enjoys, dressed up like a 9 so the brand doesn't have to admit it's a novelty.

## The Scoville problem

The Scoville scale — the actual scientific measurement of capsaicin — is logarithmic and goes into the millions. A jalapeño is around 5,000. A ghost pepper is over 1,000,000. There is no smooth ramp from one to the other; once you cross a certain threshold, you're not tasting anymore, you're enduring.

Most salsa lines pretend the ramp is linear. It isn't.

## Our five

- **1 — Mild.** Family table. Black Bean & Corn lives here.
- **2 — Bright.** Cilantro Green Olive. Heat is decoration, not the point.
- **3 — Medium.** You feel it. You like it.
- **4 — Warm.** Backs of the ears. Conversation slows down briefly.
- **5 — Hot.** Habanero territory. You signed up for this.

That is the whole map. If you have ever wished a salsa company would just *tell you the truth*, this is us trying.

## What we don't make

We don't make a "Death Sauce." We don't make a "Reaper Apocalypse Triple Scorpion Limited Edition." Those exist, and people enjoy them, and we are not in that business.

We make salsa that ends up on **enchiladas, eggs, and chicken thighs**. Five is plenty.

---

*Browse by heat: [Mild & Sweet](/products?heat=mild), [Medium](/products?heat=medium), [Hot](/products?heat=hot), or [Fruit](/products?heat=fruit).*`,
    coverImage: LOGO_FALLBACK,
    coverImageAlt: 'Jose Madrid Salsa logo',
    categorySlug: 'salsa-lore',
    tags: ['heat-scale', 'philosophy', 'product-design'],
    featured: false,
    readingMinutes: 3,
    daysAgo: 25,
  },
]

function daysAgoDate(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

async function main() {
  console.log('Seeding Heat Index content...')

  for (const cat of CATEGORIES) {
    await prisma.blogCategory.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
        accentColor: cat.accentColor,
        sortOrder: cat.sortOrder,
      },
      create: cat,
    })
    console.log(`  category: ${cat.slug}`)
  }

  for (const s of SERIES) {
    await prisma.blogSeries.upsert({
      where: { slug: s.slug },
      update: {
        name: s.name,
        tagline: s.tagline,
        description: s.description,
        accentColor: s.accentColor,
        isFeatured: s.isFeatured,
        sortOrder: s.sortOrder,
      },
      create: s,
    })
    console.log(`  series: ${s.slug}`)
  }

  for (const post of POSTS) {
    const category = await prisma.blogCategory.findUnique({
      where: { slug: post.categorySlug },
    })
    const series = post.seriesSlug
      ? await prisma.blogSeries.findUnique({ where: { slug: post.seriesSlug } })
      : null

    const publishedAt = daysAgoDate(post.daysAgo)

    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        coverImageAlt: post.coverImageAlt,
        status: 'PUBLISHED',
        publishedAt,
        featured: post.featured,
        readingMinutes: post.readingMinutes,
        tags: post.tags,
        categoryId: category?.id ?? null,
        seriesId: series?.id ?? null,
        seriesOrder: post.seriesOrder ?? null,
      },
      create: {
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        content: post.content,
        coverImage: post.coverImage,
        coverImageAlt: post.coverImageAlt,
        status: 'PUBLISHED',
        publishedAt,
        featured: post.featured,
        readingMinutes: post.readingMinutes,
        tags: post.tags,
        categoryId: category?.id ?? null,
        seriesId: series?.id ?? null,
        seriesOrder: post.seriesOrder ?? null,
      },
    })
    console.log(`  post: ${post.slug}`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
