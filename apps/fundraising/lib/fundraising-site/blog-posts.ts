/**
 * Posts carried over from the legacy fundraising site's blog
 * (josemadridsalsafundraising.com/blog). Static data: the blog has two posts
 * and no editor, so a database table would be overkill.
 */

export interface FundraisingBlogLink {
  href: string
  label: string
}

export interface FundraisingBlogPost {
  slug: string
  title: string
  /** ISO date (YYYY-MM-DD) the post was published on the legacy site. */
  date: string
  author: string
  summary: string
  /** Body paragraphs, rendered in order. */
  body: string[]
  /** Optional outbound link shown after the body (e.g. a news segment). */
  link?: FundraisingBlogLink
}

export const FUNDRAISING_BLOG_POSTS: readonly FundraisingBlogPost[] = [
  {
    slug: 'spectrum-news-1',
    title: 'Our Spectrum News 1 Feature',
    date: '2022-10-06',
    author: 'Jose Madrid Salsa',
    summary: 'Spectrum News 1 in Columbus ran a story on Jose Madrid Salsa, including an interview with Mike.',
    body: [
      'Spectrum News 1 in Columbus paid a visit to Jose Madrid Salsa and aired a story on our family-run salsa company in Zanesville, Ohio, including an interview with Mike.',
      'The full segment is on the Spectrum News 1 website. Give it a watch, then come back and try the salsa for yourself.',
    ],
    link: {
      href: 'https://spectrumnews1.com/columbus/news/2021/07/28/jose-madrid-salsa',
      label: 'Watch the story on Spectrum News 1',
    },
  },
  {
    slug: 'my-first-blog-post',
    title: 'My first blog post!',
    date: '2020-05-05',
    author: 'Matt',
    summary: 'Our first post on the fundraising website, and our first attempt at building a website at all.',
    body: [
      'Hi,',
      'Not only is this my first blog post, this is my first attempt at building a website. It only took a bunch of calls to support and a lot of help from friends (thank you!).',
      'I expect there may be a couple of errors, and I am always looking for ways to make the site more user friendly. Please get in touch; I will be happy to hear your thoughts and ideas.',
      'Thanks for reading!',
    ],
  },
]

/** Posts newest first. */
export function getFundraisingBlogPosts(): FundraisingBlogPost[] {
  return [...FUNDRAISING_BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
}

export function getFundraisingBlogPost(slug: string): FundraisingBlogPost | undefined {
  return FUNDRAISING_BLOG_POSTS.find((post) => post.slug === slug)
}

/** "October 6, 2022" — formatted in UTC so the date never shifts a day. */
export function formatFundraisingBlogDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
