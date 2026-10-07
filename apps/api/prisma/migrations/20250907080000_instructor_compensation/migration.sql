-- AlterEnum
ALTER TYPE "CompensationCalculationType" ADD VALUE IF NOT EXISTS 'PER_STUDENT';
ALTER TYPE "CompensationCalculationType" ADD VALUE IF NOT EXISTS 'HOURLY';

-- CreateTable
CREATE TABLE "instructor_compensation_rules" (
    "id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "course_id" UUID,
    "group_id" UUID,
    "type" "CompensationCalculationType" NOT NULL,
    "percentage" DECIMAL(5,2),
    "fixed_amount" DECIMAL(12,2),
    "amount_per_student" DECIMAL(12,2),
    "hourly_rate" DECIMAL(12,2),
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "instructor_compensation_rules_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "instructor_compensations"
    ADD COLUMN "period" TEXT,
    ADD COLUMN "student_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "hours_taught" DECIMAL(8,2) NOT NULL DEFAULT 0,
    ADD COLUMN "gross_revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "amount_per_student" DECIMAL(12,2),
    ADD COLUMN "hourly_rate" DECIMAL(12,2),
    ADD COLUMN "adjustments" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "adjustment_reason" TEXT,
    ADD COLUMN "final_amount" DECIMAL(12,2);

UPDATE "instructor_compensations"
SET
  "period" = to_char("period_start", 'YYYY-MM'),
  "final_amount" = "calculated_amount"
WHERE "period" IS NULL;

ALTER TABLE "instructor_compensations"
    ALTER COLUMN "period" SET NOT NULL,
    ALTER COLUMN "final_amount" SET NOT NULL;

CREATE UNIQUE INDEX "instructor_compensations_instructor_id_group_id_period_key"
    ON "instructor_compensations"("instructor_id", "group_id", "period");
CREATE INDEX "instructor_compensations_instructor_id_period_idx"
    ON "instructor_compensations"("instructor_id", "period");

CREATE INDEX "instructor_compensation_rules_instructor_id_idx" ON "instructor_compensation_rules"("instructor_id");
CREATE INDEX "instructor_compensation_rules_course_id_idx" ON "instructor_compensation_rules"("course_id");
CREATE INDEX "instructor_compensation_rules_group_id_idx" ON "instructor_compensation_rules"("group_id");
CREATE INDEX "instructor_compensation_rules_effective_from_effective_until_idx"
    ON "instructor_compensation_rules"("effective_from", "effective_until");
CREATE INDEX "instructor_compensation_rules_deleted_at_idx" ON "instructor_compensation_rules"("deleted_at");

ALTER TABLE "instructor_compensation_rules"
    ADD CONSTRAINT "instructor_compensation_rules_instructor_id_fkey"
    FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructor_compensation_rules"
    ADD CONSTRAINT "instructor_compensation_rules_course_id_fkey"
    FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "instructor_compensation_rules"
    ADD CONSTRAINT "instructor_compensation_rules_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
