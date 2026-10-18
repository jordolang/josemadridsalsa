/**
 * Whether the developer blog (/developer/blog) is served. Off since 2026-10-18:
 * the posts are personal and customers and schools could find them. While off,
 * the blog pages 404, the public blog API answers 404, and the AI chat does not
 * index the posts. Admins still manage posts in /admin/developer. The
 * /developer profile page is not affected.
 */
export const DEVELOPER_BLOG_PUBLIC = false
