CREATE TABLE "partner_api_keys" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL UNIQUE,
  "scopes" TEXT[] NOT NULL DEFAULT '{}',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "user_id" TEXT,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "partner_api_keys_is_active_idx" ON "partner_api_keys"("is_active");

ALTER TABLE "partner_api_keys"
  ADD CONSTRAINT "partner_api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
