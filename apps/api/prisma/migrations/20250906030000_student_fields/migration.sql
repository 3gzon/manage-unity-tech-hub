-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PAUSED', 'GRADUATED');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "students" ADD COLUMN "gender" "Gender",
ADD COLUMN "school" TEXT,
ADD COLUMN "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "registration_date" DATE NOT NULL DEFAULT CURRENT_DATE;

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- Backfill registration_date from created_at for existing rows
UPDATE "students" SET "registration_date" = "created_at"::date WHERE "registration_date" IS NULL;
