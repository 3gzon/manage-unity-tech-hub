-- Narrow user status to ACTIVE | DISABLED (prompt 17).
ALTER TABLE "users" ALTER COLUMN "status" DROP DEFAULT;

CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'DISABLED');

ALTER TABLE "users"
  ALTER COLUMN "status" TYPE "UserStatus_new"
  USING (
    CASE
      WHEN "status"::text IN ('INACTIVE', 'SUSPENDED') THEN 'DISABLED'
      WHEN "status"::text = 'DISABLED' THEN 'DISABLED'
      ELSE 'ACTIVE'
    END::"UserStatus_new"
  );

ALTER TYPE "UserStatus" RENAME TO "UserStatus_old";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
DROP TYPE "UserStatus_old";

ALTER TABLE "users" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- ADMIN may read and manage instructor users.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name = 'ADMIN'
  AND p.resource = 'users'
  AND p.action IN ('read', 'manage')
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
