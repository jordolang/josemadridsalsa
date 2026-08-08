import type { ResolvedPage } from './queries'
import type { HeroPanel } from '@/components/store/scroll-video-hero-home'

/**
 * Build the homepage hero panels from CMS content.
 *
 * Returns `undefined` when nothing has been customised so the hero keeps its
 * own built-in copy — that is what makes an unedited homepage render exactly
 * as it did before the CMS existed.
 */
export function homeHeroPanels(content: ResolvedPage): HeroPanel[] | undefined {
  const panels: HeroPanel[] = [1, 2, 3].map((n) => ({
    eyebrow: content.text('hero', `panel${n}Eyebrow`),
    title: content.text('hero', `panel${n}Title`),
    accent: content.text('hero', `panel${n}Accent`),
    body: content.text('hero', `panel${n}Body`),
    cta: n === 1,
  }))

  // A panel needs a headline to be usable; if the first one is blank the hero
  // has not been customised at all.
  if (!panels[0].title) return undefined

  return panels.filter((panel) => panel.title)
}
