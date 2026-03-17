-- Add CREDENTIALS to PermissionCategory enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'PermissionCategory'
      AND e.enumlabel = 'CREDENTIALS'
  ) THEN
    ALTER TYPE "PermissionCategory" ADD VALUE 'CREDENTIALS';
  END IF;
END
$$;

-- Seed credentials permissions (idempotent)
INSERT INTO "permissions" (id, name, description, category, "createdAt")
VALUES
  (gen_random_uuid()::text, 'credentials:read',  'View credentials',              'CREDENTIALS', NOW()),
  (gen_random_uuid()::text, 'credentials:write', 'Create and update credentials', 'CREDENTIALS', NOW())
ON CONFLICT (name) DO NOTHING;

-- Grant credentials permissions to ADMIN role (idempotent)
INSERT INTO "role_permissions" (id, role, "permissionId", "createdAt")
SELECT gen_random_uuid()::text, 'ADMIN'::"UserRole", p.id, NOW()
FROM "permissions" p
WHERE p.name IN ('credentials:read', 'credentials:write')
ON CONFLICT (role, "permissionId") DO NOTHING;

-- Grant credentials permissions to DEVELOPER role (idempotent)
INSERT INTO "role_permissions" (id, role, "permissionId", "createdAt")
SELECT gen_random_uuid()::text, 'DEVELOPER'::"UserRole", p.id, NOW()
FROM "permissions" p
WHERE p.name IN ('credentials:read', 'credentials:write')
ON CONFLICT (role, "permissionId") DO NOTHING;
