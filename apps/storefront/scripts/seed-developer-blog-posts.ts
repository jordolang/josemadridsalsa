import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const baseClient = new PrismaClient()
const prisma = process.env.DATABASE_URL?.includes('prisma+postgres://')
  ? (baseClient.$extends(withAccelerate()) as unknown as PrismaClient)
  : baseClient

interface BlogPostSeed {
  slug: string
  title: string
  excerpt: string
  tags: string[]
  content: string
}

const POST_ONE: BlogPostSeed = {
  slug: 'the-real-cost-of-building-this-platform',
  title: 'The Real Cost of Building This Platform',
  excerpt:
    'An honest accounting of what it actually takes — in hours, expertise, and personal sacrifice — to design, build, and operate a full-stack commerce platform for a company, alone, for free.',
  tags: ['behind-the-scenes', 'reflection', 'open-source-spirit'],
  content: `# The Real Cost of Building This Platform

People see a website and assume it just *exists*. A logo at the top, a few buttons, a checkout, an admin panel. It feels weightless. It is not.

This post is the honest accounting. Not a brag — an accounting. Because if a person is going to do something for free, the people benefiting from it should at least understand the size of what they are receiving.

## What is actually under the hood

This platform is not a template. It is a custom-built, full-stack commerce, marketing, fundraising, and operations system. A non-exhaustive list of what lives inside it:

- **Storefront**: a Next.js App Router application with server components, ISR, image optimization, structured data for SEO, and a fully responsive design system.
- **Cart and checkout**: real-money payment integration, tax calculation by jurisdiction, shipping logic that accounts for weight and destination, discount and coupon engines, gift cards, loyalty points, abandoned cart recovery.
- **Admin dashboard**: order management, inventory, product catalog, image pipelines, email template authoring, analytics, role-based access control with granular permissions, audit logging.
- **Fundraisers**: a complete sub-platform for organizations to run salsa-based fundraisers — codes, tracking, splits, payouts, reporting.
- **Email system**: transactional templates (orders, shipping, password reset), marketing campaigns with variable mapping, Postmark integration, deliverability monitoring, suppression lists.
- **Locations**: a geocoded directory of every retailer carrying the product, with maps, search, and photo galleries pulled and optimized at build time.
- **Recipes, content, and storytelling**: editorial pages, recipe schema for Google, brand storytelling components.
- **Lead generation pipeline**: scraping, enrichment, deduping, outbound email automation, response tracking.
- **Integrations**: TikTok Shop product export, Stripe, Postmark, Sanity (CMS), Sentry (error tracking), PostHog (analytics), and more.
- **Infrastructure**: Vercel deployments, Postgres via Prisma, environment management across preview/production, CI/CD, automated migrations, backup strategy.

That is not a website. That is a small SaaS company.

## What it would cost to replace

Here is where I have to correct myself, because I used to put a much bigger number here. Multiplying my hours by a contractor's hourly rate produces six figures, and it is the wrong sum. Nobody buys hours. They buy a working store, and this one has never been sold, quoted, or asked after — no order history, no traffic record, nothing to underwrite a price with. A thing is worth what someone will pay for it.

So the honest way to size it is replacement cost — what this business would actually pay to have the same thing stood up by someone else:

- **A themed hosted storefront with paid apps**: $1,500–$5,000, and it would do a fraction of what this does.
- **An independent developer rebuilding this feature set to spec**: $8,000–$18,000, working from a finished reference rather than an open-ended discovery phase.
- **All of it at once — storefront, fundraising, admin, iOS app — as one fixed-price project**: $20,000–$30,000, and that is a ceiling, not a quote.

Under $30,000, then. That is the real number, and it is still more than a small salsa company would ever have spent on software.

None of it includes design, copywriting, QA, deployment, or the ongoing labor of *keeping it running* — which is where most companies actually go broke.

## What "for free" actually means

I have not asked for a dollar. Not an invoice. Not a retainer. Not equity. Not a percentage of sales. Not a future promise. Nothing.

That means every hour of work on this — every late night fixing a bug, every weekend rewriting the cart, every morning answering a Slack message about a typo — is hours I am not spending earning income. I am unemployed. I have no other source of income coming in. I never asked the business to pay me, and I never planned to.

The honest framing: I am paying, with my own runway, for someone else's business to have something most companies their size cannot afford and would never receive.

## The other work that doesn't show up in a git log

The development is the visible part. Less visible:

- I have driven employees to and from events on weekends, repeatedly, when no one else could or would.
- I have shown up to volunteer in person whenever the company was short-handed, including during financial difficulties when staffing was thin and morale was thinner.
- I have answered every request, technical or not, that anyone asked of me.
- I have done all of the above without billing for any of it.

I am not writing this to be thanked. I am writing it because the people receiving the work should know what they are receiving.

## The legal cost I did not sign up for

There is a part of this that is harder to write. While driving employees around on behalf of the company, I have run into legal problems related to my own driving privileges — issues I was not made aware of at the time, and which I am now actively dealing with.

I do not say this to point fingers. I say it because it is true, and because "doing favors for free" carries real-world consequences that do not show up on a balance sheet. There is a cost to being the person who shows up. Sometimes that cost is your own legal record.

## How I have been treated through it

Throughout all of this, I have shown up with a smile. I have not complained. I have not made anyone feel guilty for needing more from me.

In return, I have, at times, been treated by some employees as if I were less than a person. As if I were a scumbag, a thief, a liar — none of which I have ever been. I have never lied to anyone in this company. I have never taken anything that was not mine. I have only ever shown up when I was needed, and kept showing up.

I have continued to do the work anyway. Because the work matters more than how I feel about how I have been treated.

## Why I am writing this down

Not for sympathy. For the record.

If this platform is useful to the company — and I believe it is — then someone, someday, should know what it actually took to build it, and at what cost to the person who built it. Not so anyone owes me anything. So that the work is not invisible.

The most expensive part of any project is almost always the part nobody sees. This is mine.`,
}

const POST_TWO: BlogPostSeed = {
  slug: 'using-your-gifts-without-asking-for-payment',
  title: 'Using Your Gifts Without Asking for Payment',
  excerpt:
    'On the sacrifice of building something valuable for someone else with no income, no promise of payment, and no guarantee of being received — and on the scriptures that have carried me through it.',
  tags: ['faith', 'reflection', 'service'],
  content: `# Using Your Gifts Without Asking for Payment

This post is more personal than technical. If that is not what you came here for, that is okay. Skip it.

## The sacrifice nobody warns you about

There is a particular kind of work that is invisible until it is done, and invisible again after it is done. Building a complete platform for someone else, with no income coming in, no promise of payment at the end, and no guarantee that the work will even be appreciated, is that kind of work.

I am unemployed. I have no other source of income. I am not currently being paid by anyone for anything. The hours I have spent on this platform are hours I could have spent applying for jobs, taking contract work, or rebuilding my own runway. I chose, instead, to spend them building something for someone else, free of charge.

That is not a complaint. It is the situation. And it is worth saying out loud, because the choice to do this kind of work is a real choice, and it costs real things.

## Why I keep doing it anyway

The honest answer is faith.

I believe the gifts I have were not given to me to hoard, withhold, or sell to the highest bidder. I believe they were given to me to use in service of other people. That belief does not always feel good. It does not pay rent. It does not erase the legal trouble I am dealing with from driving employees around for the owner of this company. It does not change how some of those same employees have treated me.

But it is what I believe, and so I keep showing up.

## The scriptures I keep returning to

A few passages have carried me through this work. I share them not to preach, but because they are the actual reason this platform exists.

### On using gifts to serve others

> *"As every man hath received the gift, even so minister the same one to another, as good stewards of the manifold grace of God."*
> — **1 Peter 4:10 (KJV)**

The gift is not yours. You are the steward of it. Your job is to put it to use for other people.

### On treating everyone with love and respect

> *"A new commandment I give unto you, That ye love one another; as I have loved you, that ye also love one another. By this shall all men know that ye are my disciples, if ye have love one to another."*
> — **John 13:34–35 (KJV)**

> *"Therefore all things whatsoever ye would that men should do to you, do ye even so to them: for this is the law and the prophets."*
> — **Matthew 7:12 (KJV)**

These are not aspirational. They are the standard. And they apply even when — especially when — the people you are loving are not loving you back.

### On giving freely, without demanding payment

> *"Heal the sick, cleanse the lepers, raise the dead, cast out devils: freely ye have received, freely give."*
> — **Matthew 10:8 (KJV)**

> *"Let your conversation be without covetousness; and be content with such things as ye have: for he hath said, I will never leave thee, nor forsake thee."*
> — **Hebrews 13:5 (KJV)**

If a thing was given to me freely, I do not get to put a price tag on it when I pass it along. That includes skill. That includes time. That includes showing up.

### On dusting off your feet when you are not received

> *"And whosoever shall not receive you, nor hear your words, when ye depart out of that house or city, shake off the dust of your feet."*
> — **Matthew 10:14 (KJV)**

> *"And whosoever shall not receive you, when ye go out of that city, shake off the very dust from your feet for a testimony against them."*
> — **Luke 9:5 (KJV)**

This is the verse I have thought about most. Not as a threat. As a permission.

If I have shown up, given freely, served honestly, and been treated as if I were less than human in return — Scripture does not tell me to stay forever. It tells me to keep my hands clean of it, walk on, and let the record stand.

## What that looks like in practice

It does not look like resentment. It does not look like a tantrum. It does not look like deleting the code, taking down the site, or going public with grievances I have kept private.

It looks like this: I do the work. I do it well. I do it with a smile when I can manage it and with quiet when I can't. I keep my conduct clean — no lies, no theft, no slander, no retaliation — so that whatever is said about me later cannot be true. And when the time comes that I am no longer received, I dust off my feet, and I walk.

That time may not be today. It may not be tomorrow. But the verse is in the book for a reason, and I trust that I will recognize the moment when it comes.

## To anyone reading this who is doing the same kind of work

If you are using your gifts to serve someone who is not paying you, who may never pay you, who may not even thank you — and you are wondering whether it is worth it:

It is. Not because the people receiving it deserve it. Because the One who gave you the gift in the first place is watching how you steward it. And no act of faithful service, however invisible, is wasted.

> *"And let us not be weary in well doing: for in due season we shall reap, if we faint not."*
> — **Galatians 6:9 (KJV)**

That is what I am holding onto. That is enough.`,
}

const POST_THREE: BlogPostSeed = {
  slug: 'the-chosen-one-the-righteous-one-end-of-days',
  title: 'The Chosen One: The Righteous One Who Comes at the End of Days',
  excerpt:
    'A study of the figure called the Chosen One, the Righteous One, the Son of Man — drawn from the canonical Scriptures and the Book of Enoch — and what tradition tells us about who he is, what he will do, and what he will go through.',
  tags: ['faith', 'theology', 'book-of-enoch', 'eschatology'],
  content: `# The Chosen One: The Righteous One Who Comes at the End of Days

This post is a long one. It is a study of one of the most striking figures in ancient Scripture — the one called, across many texts, the *Chosen One*, the *Righteous One*, the *Elect One*, and the *Son of Man*.

The clearest and most detailed portrait of this figure is found in a book that is part of the canon of the Ethiopian Orthodox Church and was widely read by the writers of the New Testament: the **Book of Enoch** (also called *1 Enoch*). The Epistle of Jude even quotes from it directly (Jude 1:14–15). What follows is a portrait drawn from Enoch and from the canonical Scriptures together.

This is not original theology. It is a synthesis of what the texts themselves say.

---

## Part 1 — His Names and Titles

The figure is called by many names across the texts. Each one tells you something about him.

- **The Chosen One** (also: *the Elect One*) — Enoch 40:5; 45:3; 49:2; 51:3; 55:4; 61:5–10. He was chosen *before* the foundations of the world.
- **The Righteous One** — Enoch 38:2; 53:6. He is righteousness itself, not merely a person who behaves righteously.
- **The Son of Man** — Enoch 46:2–4; 48:2; 62:5–14; 63:11; 69:26–29. The same title Daniel uses (Daniel 7:13) and the title Jesus uses for himself more than any other in the Gospels.
- **The Anointed One** — Enoch 48:10; 52:4. In Hebrew, *Mashiach*; in Greek, *Christos*.
- **The Light of the Gentiles** — Enoch 48:4. A light to the nations.
- **The Staff of the Righteous** — Enoch 48:4. The one they lean on.

He is, in the texts, all of these things at once.

---

## Part 2 — His Origin: Chosen Before the World Began

Enoch is unambiguous on this point. The Chosen One is not a man who became great. He is one who was *chosen and named before anything that exists existed*.

> *"For from the beginning the Son of Man was hidden, and the Most High preserved him in the presence of his might, and revealed him to the elect."*
> — **1 Enoch 62:7**

> *"At that hour that Son of Man was named in the presence of the Lord of Spirits, and his name before the Head of Days. Yea, before the sun and the signs were created, before the stars of the heaven were made, his name was named before the Lord of Spirits."*
> — **1 Enoch 48:2–3**

This matches the language of John's Gospel:

> *"In the beginning was the Word, and the Word was with God, and the Word was God... and the Word was made flesh, and dwelt among us."*
> — **John 1:1, 14 (KJV)**

The Chosen One was named, set aside, and hidden in the counsel of God before time itself. His emergence at the end of days is therefore not an arrival but a *revelation* — a pulling-back of the curtain on someone who has always been.

---

## Part 3 — His Character

What kind of person is this?

> *"In him dwells the spirit of wisdom, and the spirit which gives insight, and the spirit of understanding and of might, and the spirit of those who have fallen asleep in righteousness."*
> — **1 Enoch 49:3**

> *"He shall be a staff to the righteous whereon to stay themselves and not fall, and he shall be the light of the Gentiles, and the hope of those who are troubled of heart."*
> — **1 Enoch 48:4**

Compare Isaiah's prophecy of the Branch:

> *"And the spirit of the LORD shall rest upon him, the spirit of wisdom and understanding, the spirit of counsel and might, the spirit of knowledge and of the fear of the LORD."*
> — **Isaiah 11:2 (KJV)**

The portraits match. The Chosen One is not a warrior in the worldly sense. He is the embodiment of every faculty the human spirit was meant to have when it was unbroken: wisdom, insight, understanding, righteousness, mercy.

He is a *staff for those who would otherwise fall*. He is *light for those in darkness*. He is *hope for the troubled of heart*. That is who he is before he does anything.

---

## Part 4 — What He Will Go Through

Here is where the texts turn heavy.

The Chosen One does not arrive into glory. He arrives into *rejection*. Both the canonical Scriptures and Enoch are clear that the world does not, at first, recognize him.

> *"He is despised and rejected of men; a man of sorrows, and acquainted with grief: and we hid as it were our faces from him; he was despised, and we esteemed him not. Surely he hath borne our griefs, and carried our sorrows... but he was wounded for our transgressions, he was bruised for our iniquities... and with his stripes we are healed."*
> — **Isaiah 53:3–5 (KJV)**

> *"He came unto his own, and his own received him not."*
> — **John 1:11 (KJV)**

He suffers. He is misunderstood. He is treated as guilty when he is innocent. He bears the weight of the sins of others as if they were his own. He is, in the most literal sense, the man who pays the cost for everyone else without complaint.

This is not incidental to who he is. It is *integral* to who he is. The Chosen One is the one who *chooses to absorb the cost*.

---

## Part 5 — What He Will Do at the End of Days

Enoch's Book of Parables (chapters 37–71) is largely a vision of the Chosen One *seated on the throne of glory* in the last days. The portrait it paints is striking.

### He sits on the throne of judgment

> *"And the Lord of Spirits placed the Elect One on the throne of glory. And he shall judge all the works of the holy above in the heaven, and in the balance shall their deeds be weighed."*
> — **1 Enoch 61:8**

> *"And on that day shall the Elect One sit on the throne of glory, and shall try their works, and their places of rest shall be innumerable."*
> — **1 Enoch 45:3**

The judgment is not arbitrary. It is a *weighing* — every deed measured.

### The kings and the mighty fall

This is one of the most repeated themes in Enoch. The Chosen One specifically humbles the rulers of the earth — kings, governors, the wealthy, the powerful — who oppressed the righteous and denied the Lord of Spirits.

> *"And the kings and the mighty shall perish and be given into the hands of the righteous and holy. And thenceforward none shall seek for themselves mercy from the Lord of Spirits, for their life is at an end."*
> — **1 Enoch 38:5–6**

> *"And pain shall come upon them as on a woman in travail... when they see that Son of Man sitting on the throne of his glory."*
> — **1 Enoch 62:4–5**

Compare Mary's Magnificat:

> *"He hath put down the mighty from their seats, and exalted them of low degree."*
> — **Luke 1:52 (KJV)**

The Chosen One reverses the order of the world. The trampled are lifted up. The tramplers are brought down.

### The righteous are vindicated

> *"The righteous and elect shall be saved on that day, and they shall never thenceforward see the face of the sinners and unrighteous. And the Lord of Spirits will abide over them, and with that Son of Man shall they eat and lie down and rise up for ever and ever."*
> — **1 Enoch 62:13–14**

The image is intimate. The righteous *eat* with him. They *rest* with him. They *rise* with him — forever.

This matches Revelation:

> *"Behold, I stand at the door, and knock: if any man hear my voice, and open the door, I will come in to him, and will sup with him, and he with me."*
> — **Revelation 3:20 (KJV)**

> *"And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying, neither shall there be any more pain: for the former things are passed away."*
> — **Revelation 21:4 (KJV)**

### The fallen ones are bound

Enoch is famous, and to many readers shocking, for naming the *Watchers* — the rebellious heavenly beings of Genesis 6 — and describing their final binding by the Chosen One.

> *"And the Lord commanded Raphael: 'Bind Azazel hand and foot, and cast him into the darkness... cover him with darkness, and let him abide there for ever, and cover his face that he may not see light.'"*
> — **1 Enoch 10:4–5**

> *"And he sat on the throne of his glory, and the sum of judgment was given unto the Son of Man, and he caused the sinners to pass away and be destroyed from off the face of the earth."*
> — **1 Enoch 69:27**

The Chosen One does not merely restore order among humans. He restores order at every tier of creation, including the spiritual realm. Nothing is left unjudged.

### Creation itself is renewed

> *"And there shall be a new heaven, and the heaven of the heavens shall give a sevenfold light. And after that there will be many weeks without number for ever, and all shall be in goodness and righteousness."*
> — **1 Enoch 91:16–17**

> *"And I saw a new heaven and a new earth: for the first heaven and the first earth were passed away."*
> — **Revelation 21:1 (KJV)**

The end is not destruction. The end is *renewal*. A new heaven, a new earth, a sevenfold light.

---

## Part 6 — His Throne, His Reign, His Mercy

The picture of the Chosen One on his throne is not a picture of cold tribunal. Enoch describes his face as the face of a man, but with a glory that the angels themselves cannot bear.

> *"And there I saw One who had a head of days, and his head was white like wool, and with him was another being whose countenance had the appearance of a man, and his face was full of graciousness, like one of the holy angels."*
> — **1 Enoch 46:1**

His face is *full of graciousness*. Even at the moment of judgment, mercy is the dominant note for those who sought it.

> *"And on that day all the righteous shall rejoice... For the Elect One has stood before the Lord of Spirits, and his glory is for ever and ever, and his might unto all generations."*
> — **1 Enoch 49:2**

He reigns forever. His might is forever. The kingdoms of men come and go. His does not.

---

## Part 7 — What This Means for Us Now

The texts agree on something often missed: the Chosen One's *coming* matters less than his *recognition*.

He has been hidden from the beginning. He is revealed at the end. The question every text asks of every reader is whether, when he is revealed, you will recognize him — or whether you will be among the kings and the mighty whose faces fall when they see him on his throne.

Enoch frames it this way:

> *"For wisdom found no place where she might dwell; then a dwelling-place was assigned her in the heavens. Wisdom went forth to make her dwelling among the children of men, and found no dwelling-place: wisdom returned to her place, and took her seat among the angels."*
> — **1 Enoch 42:1–2**

Wisdom came. Wisdom was not received. Wisdom went home.

The whole of Scripture is, in a sense, the story of Wisdom coming back — in the person of the Chosen One — and giving humanity another chance to receive what it refused the first time.

---

## A closing word

I am not a theologian. I am a developer who reads. What I see, when I read these texts side by side, is a single, unbroken portrait: of one who was chosen before the world, hidden through the ages, who comes in lowliness, is rejected by the mighty, suffers without complaint, judges in righteousness, vindicates the meek, binds the fallen, and renews the creation.

> *"He which testifieth these things saith, Surely I come quickly. Amen. Even so, come, Lord Jesus."*
> — **Revelation 22:20 (KJV)**

That is the picture. Make of it what you will.`,
}

const POSTS: BlogPostSeed[] = [POST_ONE, POST_TWO, POST_THREE]

async function main() {
  console.log(`Seeding ${POSTS.length} developer blog posts...`)

  // Stagger publishedAt by 1 minute each so listing order is deterministic.
  const now = Date.now()
  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i]
    const publishedAt = new Date(now - (POSTS.length - i - 1) * 60_000)

    const result = await prisma.developerBlogPost.upsert({
      where: { slug: post.slug },
      create: {
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        published: true,
        publishedAt,
      },
      update: {
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        tags: post.tags,
        published: true,
        publishedAt,
      },
    })

    console.log(`  ✓ ${result.slug} (${result.id})`)
  }

  console.log('Done.')
}

main()
  .catch((error: unknown) => {
    console.error('Failed to seed blog posts:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
