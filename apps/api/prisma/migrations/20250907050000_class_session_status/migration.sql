-- Migrate legacy IN_PROGRESS sessions to SCHEDULED, then drop enum value
UPDATE "class_sessions" SET "status" = 'SCHEDULED' WHERE "status" = 'IN_PROGRESS';

ALTER TYPE "ClassSessionStatus" RENAME TO "ClassSessionStatus_old";

CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

ALTER TABLE "class_sessions"
  ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "class_sessions"
  ALTER COLUMN "status" TYPE "ClassSessionStatus"
  USING ("status"::text::"ClassSessionStatus");

ALTER TABLE "class_sessions"
  ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';

DROP TYPE "ClassSessionStatus_old";
