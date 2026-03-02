-- Create enum for form template status
CREATE TYPE "FormTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- Create table for saved form templates
CREATE TABLE "form_templates" (
    "id" TEXT PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "estimated_completion" TEXT,
    "recommended_uses" TEXT[],
    "status" "FormTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "structure" JSONB NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "form_templates_slug_key" ON "form_templates"("slug");

-- Create table for version history
CREATE TABLE "form_template_versions" (
    "id" TEXT PRIMARY KEY,
    "template_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "structure" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,
    CONSTRAINT "form_template_versions_template_id_fkey"
        FOREIGN KEY ("template_id") REFERENCES "form_templates"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "form_template_versions_template_id_version_key"
    ON "form_template_versions"("template_id", "version");
