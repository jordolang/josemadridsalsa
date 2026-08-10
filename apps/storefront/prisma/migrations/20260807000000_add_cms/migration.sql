-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PageKind" AS ENUM ('SYSTEM', 'LANDING');

-- CreateEnum
CREATE TYPE "BannerPlacement" AS ENUM ('SITE_WIDE_TOP', 'HOMEPAGE_HERO', 'CATEGORY', 'CHECKOUT', 'FUNDRAISING');

-- CreateEnum
CREATE TYPE "AnnouncementVariant" AS ENUM ('INFO', 'PROMO', 'WARNING', 'SUCCESS');

-- CreateEnum
CREATE TYPE "NavigationLocation" AS ENUM ('HEADER', 'FOOTER', 'MOBILE', 'UTILITY');


-- CreateTable
CREATE TABLE "cms_pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "PageKind" NOT NULL DEFAULT 'LANDING',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "ogImage" TEXT,
    "canonicalUrl" TEXT,
    "noIndex" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_page_sections" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL DEFAULT '{}',
    "reusableSectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_reusable_sections" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_reusable_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_banners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "placement" "BannerPlacement" NOT NULL DEFAULT 'SITE_WIDE_TOP',
    "headline" TEXT,
    "body" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "ctaText" TEXT,
    "ctaHref" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "targetPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_announcements" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "ctaText" TEXT,
    "ctaHref" TEXT,
    "variant" "AnnouncementVariant" NOT NULL DEFAULT 'INFO',
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "targetPaths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faq_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_faq_items" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "categoryId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_navigation_menus" (
    "id" TEXT NOT NULL,
    "location" "NavigationLocation" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_navigation_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_navigation_items" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "parentId" TEXT,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "description" TEXT,
    "iconName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_footer_settings" (
    "id" TEXT NOT NULL,
    "tagline" TEXT,
    "aboutText" TEXT,
    "copyrightText" TEXT,
    "newsletterHeading" TEXT,
    "newsletterBody" TEXT,
    "socialLinks" JSONB,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "addressLines" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_footer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cms_redirects" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cms_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cms_pages_slug_key" ON "cms_pages"("slug");

-- CreateIndex
CREATE INDEX "cms_pages_status_publishedAt_idx" ON "cms_pages"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "cms_pages_kind_idx" ON "cms_pages"("kind");

-- CreateIndex
CREATE INDEX "cms_page_sections_pageId_sortOrder_idx" ON "cms_page_sections"("pageId", "sortOrder");

-- CreateIndex
CREATE INDEX "cms_page_sections_reusableSectionId_idx" ON "cms_page_sections"("reusableSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "cms_reusable_sections_key_key" ON "cms_reusable_sections"("key");

-- CreateIndex
CREATE INDEX "cms_banners_placement_status_priority_idx" ON "cms_banners"("placement", "status", "priority");

-- CreateIndex
CREATE INDEX "cms_announcements_status_priority_idx" ON "cms_announcements"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "cms_faq_categories_slug_key" ON "cms_faq_categories"("slug");

-- CreateIndex
CREATE INDEX "cms_faq_items_categoryId_sortOrder_idx" ON "cms_faq_items"("categoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "cms_faq_items_status_idx" ON "cms_faq_items"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cms_navigation_menus_location_key" ON "cms_navigation_menus"("location");

-- CreateIndex
CREATE INDEX "cms_navigation_items_menuId_parentId_sortOrder_idx" ON "cms_navigation_items"("menuId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "cms_redirects_source_key" ON "cms_redirects"("source");

-- CreateIndex
CREATE INDEX "cms_redirects_isActive_idx" ON "cms_redirects"("isActive");

-- AddForeignKey

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "cms_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_page_sections" ADD CONSTRAINT "cms_page_sections_reusableSectionId_fkey" FOREIGN KEY ("reusableSectionId") REFERENCES "cms_reusable_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_faq_items" ADD CONSTRAINT "cms_faq_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cms_faq_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation_items" ADD CONSTRAINT "cms_navigation_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "cms_navigation_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cms_navigation_items" ADD CONSTRAINT "cms_navigation_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cms_navigation_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

