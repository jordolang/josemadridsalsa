-- Two-factor authentication for admin sign-in. Additive only: nullable columns on users
-- plus a new table, so existing accounts are unaffected until they enrol.

ALTER TABLE "users"
  ADD COLUMN "twoFactorSecret" TEXT,
  ADD COLUMN "twoFactorSecretIv" TEXT,
  ADD COLUMN "twoFactorEnabledAt" TIMESTAMP(3);

CREATE TABLE "two_factor_recovery_codes" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "two_factor_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- Only the hash is stored, so a leak of this table does not yield usable second factors.
CREATE UNIQUE INDEX "two_factor_recovery_codes_userId_codeHash_key"
  ON "two_factor_recovery_codes"("userId", "codeHash");
CREATE INDEX "two_factor_recovery_codes_userId_idx" ON "two_factor_recovery_codes"("userId");

ALTER TABLE "two_factor_recovery_codes"
  ADD CONSTRAINT "two_factor_recovery_codes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
