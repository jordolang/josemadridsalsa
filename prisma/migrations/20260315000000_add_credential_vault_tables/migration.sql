-- CreateTable
CREATE TABLE "service_credentials" (
    "id" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "username" TEXT,
    "enc_value" TEXT NOT NULL,
    "enc_iv" TEXT NOT NULL,
    "enc_tag" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "password_changed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_access_grants" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "granted_by_email" TEXT NOT NULL,
    "can_view" BOOLEAN NOT NULL DEFAULT true,
    "can_add" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "can_upload" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "credential_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_credentials_service_name_idx" ON "service_credentials"("service_name");

-- CreateIndex
CREATE UNIQUE INDEX "credential_access_grants_email_key" ON "credential_access_grants"("email");

-- CreateIndex
CREATE INDEX "credential_access_grants_email_idx" ON "credential_access_grants"("email");
