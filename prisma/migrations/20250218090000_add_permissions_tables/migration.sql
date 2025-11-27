DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'PermissionCategory'
  ) THEN
    CREATE TYPE "PermissionCategory" AS ENUM (
      'ORDERS',
      'PRODUCTS',
      'USERS',
      'CONTENT',
      'ANALYTICS',
      'SETTINGS',
      'FINANCIALS',
      'API_KEYS',
      'MESSAGING',
      'SOCIAL_MEDIA'
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'DEVELOPER'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'DEVELOPER';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'UserRole'
      AND e.enumlabel = 'STAFF'
  ) THEN
    ALTER TYPE "UserRole" ADD VALUE 'STAFF';
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "PermissionCategory" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "permissions_name_key" ON "permissions"("name");
CREATE INDEX IF NOT EXISTS "permissions_category_idx" ON "permissions"("category");

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" TEXT NOT NULL,
  "role" "UserRole" NOT NULL,
  "permissionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_permissionId_key"
  ON "role_permissions"("role", "permissionId");
CREATE INDEX IF NOT EXISTS "role_permissions_role_idx" ON "role_permissions"("role");
