-- CreateEnum
CREATE TYPE "CourseCategory" AS ENUM (
  'KIDS_PROGRAMMING',
  'WEB_DEVELOPMENT',
  'FULL_STACK',
  'AI_ENGINEERING',
  'DATA_ENGINEERING',
  'DESIGN',
  'ENGLISH',
  'SUPPLEMENTARY_EDUCATION',
  'OTHER'
);

-- GroupStatus: DRAFT -> PLANNED
ALTER TYPE "GroupStatus" RENAME VALUE 'DRAFT' TO 'PLANNED';

-- Course fields
ALTER TABLE "courses"
  ADD COLUMN "category" "CourseCategory" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "age_min" INTEGER,
  ADD COLUMN "age_max" INTEGER,
  ADD COLUMN "duration_months" INTEGER,
  ADD COLUMN "default_monthly_price" DECIMAL(12, 2);

UPDATE "courses"
SET "duration_months" = CEIL("duration_weeks" / 4.0)::INTEGER
WHERE "duration_weeks" IS NOT NULL;

ALTER TABLE "courses" DROP COLUMN IF EXISTS "duration_weeks";

CREATE INDEX "courses_category_idx" ON "courses"("category");

-- GroupSchedule table
CREATE TABLE "group_schedules" (
  "id" UUID NOT NULL,
  "group_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_schedules_pkey" PRIMARY KEY ("id")
);

INSERT INTO "group_schedules" ("id", "group_id", "day_of_week", "start_time", "end_time", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  "id",
  "schedule_day_of_week",
  "schedule_start_time",
  "schedule_end_time",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "groups"
WHERE "schedule_day_of_week" IS NOT NULL
  AND "schedule_start_time" IS NOT NULL
  AND "schedule_end_time" IS NOT NULL;

ALTER TABLE "groups"
  DROP COLUMN IF EXISTS "schedule_day_of_week",
  DROP COLUMN IF EXISTS "schedule_start_time",
  DROP COLUMN IF EXISTS "schedule_end_time";

ALTER TABLE "groups" RENAME COLUMN "max_students" TO "capacity";

ALTER TABLE "groups" ALTER COLUMN "status" SET DEFAULT 'PLANNED';

CREATE UNIQUE INDEX "group_schedules_group_id_day_of_week_start_time_end_time_key"
  ON "group_schedules"("group_id", "day_of_week", "start_time", "end_time");
CREATE INDEX "group_schedules_group_id_idx" ON "group_schedules"("group_id");

ALTER TABLE "group_schedules"
  ADD CONSTRAINT "group_schedules_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enrollment billing flag
ALTER TABLE "enrollments"
  ADD COLUMN "billing_enabled" BOOLEAN NOT NULL DEFAULT true;
