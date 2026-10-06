import { FUNDRAISING_BLOG_POSTS } from './blog-posts'

/**
 * The fundraising site's static content pages, as host-relative paths on the
 * fundraising host. Used to build that host's sitemap.
 */
export const FUNDRAISING_STATIC_PAGES: readonly string[] = [
  '/',
  '/why-jose-madrid',
  '/start',
  '/sign-up',
  '/submit',
  '/our-story',
  '/testimonials',
  '/survey',
  '/blog',
  ...FUNDRAISING_BLOG_POSTS.map((post) => `/blog/${post.slug}`),
  '/contact',
  '/shipping',
]
