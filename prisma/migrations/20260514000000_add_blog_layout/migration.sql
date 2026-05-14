-- CreateEnum
CREATE TYPE "BlogPostLayout" AS ENUM ('STANDARD', 'LONGFORM', 'GALLERY', 'VIDEO', 'MINIMAL');

-- AlterTable
ALTER TABLE "blog_posts"
  ADD COLUMN "layout" "BlogPostLayout" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "galleryImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "videoUrl" TEXT;
