import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  ClipboardPen,
  Download,
  Mail,
  Megaphone,
  Phone,
  Send,
  SlidersHorizontal,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FUNDRAISING_CONTACT } from '@/components/fundraising-site/nav'
import { cn } from '@/lib/utils'

export const CAMPAIGN_GUIDE_PDF = '/fundraising/downloads/how-a-fundraising-campaign-works.pdf'

interface CampaignStep {
  title: string
  short: string
  icon: LucideIcon
  /** Gradient for the step's number badge; literal so Tailwind keeps the classes. */
  accent: string
  text: string
  checklist?: readonly string[]
  link?: { href: string; label: string }
  image?: { src: string; alt: string; width: number; height: number }
  isNew?: boolean
}

export const CAMPAIGN_STEPS: readonly CampaignStep[] = [
  {
    title: 'Sign up for your fundraiser',
    short: 'Sign up',
    icon: ClipboardPen,
    accent: 'from-verde-500 to-verde-700',
    text: 'Start on our fundraising start page and choose how your group wants to raise money.',
    link: { href: '/start', label: 'fundraising.josemadridsalsa.com/start' },
  },
  {
    title: 'Set up your campaign',
    short: 'Set up',
    icon: SlidersHorizontal,
    accent: 'from-verde-600 to-salsa-500',
    text: 'Make your choices and tell supporters your story:',
    checklist: [
      'Pick a salsa package: 9, 16 or 25 flavors',
      'Choose order forms or online only',
      'Choose your three campaign colors',
      'Upload a logo and/or a cover photo',
      'Write a mission statement and an About Us description for your page',
    ],
  },
  {
    title: 'Create your fundraiser account',
    short: 'Account',
    icon: UserPlus,
    accent: 'from-salsa-500 to-salsa-700',
    text: 'When everything is complete, create your fundraiser account. From then on you can log in to your fundraising portal.',
  },
  {
    title: 'Personalize your page and enlist your team',
    short: 'Team',
    icon: Users,
    accent: 'from-salsa-600 to-chile-500',
    text: 'In the portal, personalize your fundraising page, add your team members and send each of them a personal invite by email to get them enlisted.',
    image: {
      src: '/fundraising/how-it-works/portal-page-editor.webp',
      alt: 'The fundraiser portal Page Editor, with sections for the hero banner, logo, mission statement, progress bar, products and leaderboard',
      width: 1512,
      height: 700,
    },
  },
  {
    title: 'Sell the salsa',
    short: 'Sell',
    icon: Megaphone,
    accent: 'from-chile-500 to-chile-700',
    text: 'Now go out and sell! The documents for every program are on our fundraising start page. Download the right file, unzip it and start selling.',
    link: { href: '/start', label: 'Get your program documents' },
  },
  {
    title: 'Submit your final totals',
    short: 'Submit',
    icon: Send,
    accent: 'from-chile-600 to-salsa-700',
    text: 'When you are finished, submit your final collected totals and orders to us. We get every order filled so everyone gets paid and gets their salsa quickly and on time.',
    link: { href: '/submit', label: 'fundraising.josemadridsalsa.com/submit' },
    isNew: true,
  },
]

/** Six-step infographic of a fundraising campaign, from sign-up to final submission. */
export function CampaignProcess({ className }: { className?: string }) {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className={cn('relative overflow-hidden py-16 lg:py-20', className)}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-salsa-600">Your campaign, step by step</p>
          <h2 id="how-it-works-heading" className="mt-2 font-serif text-3xl font-bold text-foreground lg:text-4xl">
            How a fundraising campaign works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Six steps take your group from sign-up to salsa on your supporters&apos; tables.
          </p>
          <Button size="lg" variant="outline" className="mt-6 h-auto whitespace-normal border-salsa-500 py-3 text-salsa-600 hover:bg-salsa-50" asChild>
            <a href={CAMPAIGN_GUIDE_PDF} download>
              <Download className="mr-2 h-4 w-4" aria-hidden /> Download the step-by-step guide (PDF)
            </a>
          </Button>
        </div>

        <ol aria-hidden className="mx-auto mt-12 hidden max-w-4xl grid-cols-6 md:grid">
          {CAMPAIGN_STEPS.map((step, index) => (
            <li key={step.short} className="relative flex flex-col items-center text-center">
              {index > 0 ? (
                <span className="absolute right-1/2 top-7 h-1 w-full -translate-y-1/2 bg-gradient-to-r from-verde-300 via-salsa-300 to-chile-300" />
              ) : null}
              <span className={cn('relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ring-4 ring-background', step.accent)}>
                <step.icon className="h-6 w-6" />
              </span>
              <span className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {index + 1}</span>
              <span className="text-sm font-semibold text-foreground">{step.short}</span>
            </li>
          ))}
        </ol>

        <ol className="relative mx-auto mt-14 max-w-5xl space-y-10 lg:space-y-14">
          <span
            aria-hidden
            className="absolute bottom-0 left-6 top-0 w-1 -translate-x-1/2 rounded-full bg-gradient-to-b from-verde-500 via-salsa-500 to-chile-500 lg:left-1/2"
          />
          {CAMPAIGN_STEPS.map((step, index) => {
            const onRight = index % 2 === 1
            return (
              <li key={step.title} className="relative pl-16 lg:grid lg:grid-cols-2 lg:gap-20 lg:pl-0">
                <span
                  className={cn(
                    'absolute left-6 top-0 z-10 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br font-serif text-xl font-bold text-white shadow-lg ring-4 ring-background lg:left-1/2 lg:h-14 lg:w-14 lg:text-2xl',
                    step.accent,
                  )}
                >
                  <span className="sr-only">Step </span>
                  {index + 1}
                </span>

                <div
                  aria-hidden
                  className={cn(
                    'hidden select-none items-start font-serif text-[7rem] font-bold leading-none text-salsa-100 lg:row-start-1 lg:flex',
                    onRight ? 'lg:col-start-1 lg:justify-end' : 'lg:col-start-2 lg:justify-start',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </div>

                <article
                  className={cn(
                    'card surface-shadow relative p-6 lg:row-start-1',
                    onRight ? 'lg:col-start-2' : 'lg:col-start-1',
                    step.isNew && 'border-2 border-chile-400',
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-salsa-50 text-salsa-600">
                      <step.icon className="h-6 w-6" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      {step.isNew ? (
                        <span className="mb-1 inline-block rounded-full bg-chile-100 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-chile-800">
                          New step
                        </span>
                      ) : null}
                      <h3 className="font-serif text-xl font-bold text-foreground">{step.title}</h3>
                    </div>
                  </div>
                  <p className="mt-4 text-muted-foreground">{step.text}</p>
                  {step.checklist ? (
                    <ul className="mt-4 space-y-2">
                      {step.checklist.map((item) => (
                        <li key={item} className="flex gap-2 text-foreground/90">
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-verde-600" aria-hidden />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {step.image ? (
                    <Image
                      src={step.image.src}
                      alt={step.image.alt}
                      width={step.image.width}
                      height={step.image.height}
                      sizes="(min-width: 1024px) 460px, 100vw"
                      className="mt-5 rounded-lg border border-border"
                    />
                  ) : null}
                  {step.link ? (
                    <Link
                      href={step.link.href}
                      className="mt-4 inline-flex items-center gap-1 font-semibold [overflow-wrap:anywhere] text-salsa-600 hover:underline"
                    >
                      {step.link.label} <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                    </Link>
                  ) : null}
                </article>
              </li>
            )
          })}
        </ol>

        <div className="mx-auto mt-14 max-w-3xl rounded-2xl bg-muted p-6 text-center">
          <p className="font-serif text-xl font-bold text-foreground">Questions? Just ask.</p>
          <p className="mt-2 text-muted-foreground">Please don&apos;t hesitate to reach out. Thank you for fundraising with us!</p>
          <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <a href={`mailto:${FUNDRAISING_CONTACT.email}`} className="inline-flex items-center gap-2 font-semibold text-salsa-600 hover:underline">
              <Mail className="h-4 w-4" aria-hidden /> {FUNDRAISING_CONTACT.email}
            </a>
            <a href={FUNDRAISING_CONTACT.phoneHref} className="inline-flex items-center gap-2 font-semibold text-salsa-600 hover:underline">
              <Phone className="h-4 w-4" aria-hidden /> {FUNDRAISING_CONTACT.phone}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
