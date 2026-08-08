-- Link a social-media post back to the blog article it cross-posts.
--
-- One article maps to at most one SocialMediaPost so repeated publishes or
-- "Cross-post now" clicks reuse the same post (and its per-account idempotency
-- guards) instead of spawning a duplicate Facebook/X/Google post each save.
-- Null means the SocialMediaPost was composed directly, not from a blog article.
-- ON DELETE SET NULL keeps the social post (and its published record on the
-- network) even if the blog article is later deleted.
ALTER TABLE "social_media_posts" ADD COLUMN "blogPostId" TEXT;

CREATE UNIQUE INDEX "social_media_posts_blogPostId_key" ON "social_media_posts"("blogPostId");

ALTER TABLE "social_media_posts"
  ADD CONSTRAINT "social_media_posts_blogPostId_fkey"
  FOREIGN KEY ("blogPostId") REFERENCES "blog_posts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
