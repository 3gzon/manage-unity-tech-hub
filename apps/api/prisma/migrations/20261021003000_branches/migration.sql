-- Two school branches. Existing records stay with Vushtrri.
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

INSERT INTO "branches" ("id", "code", "name", "sort_order", "updated_at") VALUES
  ('a1000000-0000-4000-8000-000000000001', 'vushtrri', 'Vushtrri', 1, CURRENT_TIMESTAMP),
  ('a2000000-0000-4000-8000-000000000002', 'skenderaj', 'Skenderaj', 2, CURRENT_TIMESTAMP);

ALTER TABLE "users" ADD COLUMN "branch_id" UUID;
ALTER TABLE "families" ADD COLUMN "branch_id" UUID;
ALTER TABLE "students" ADD COLUMN "branch_id" UUID;
ALTER TABLE "parents" ADD COLUMN "branch_id" UUID;
ALTER TABLE "instructors" ADD COLUMN "branch_id" UUID;
ALTER TABLE "courses" ADD COLUMN "branch_id" UUID;
ALTER TABLE "groups" ADD COLUMN "branch_id" UUID;
ALTER TABLE "student_feedback" ADD COLUMN "branch_id" UUID;
ALTER TABLE "enrollments" ADD COLUMN "branch_id" UUID;
ALTER TABLE "class_sessions" ADD COLUMN "branch_id" UUID;
ALTER TABLE "attendances" ADD COLUMN "branch_id" UUID;
ALTER TABLE "discounts" ADD COLUMN "branch_id" UUID;
ALTER TABLE "invoices" ADD COLUMN "branch_id" UUID;
ALTER TABLE "payments" ADD COLUMN "branch_id" UUID;
ALTER TABLE "instructor_compensation_rules" ADD COLUMN "branch_id" UUID;
ALTER TABLE "instructor_compensations" ADD COLUMN "branch_id" UUID;
ALTER TABLE "expenses" ADD COLUMN "branch_id" UUID;
ALTER TABLE "employment_contracts" ADD COLUMN "branch_id" UUID;
ALTER TABLE "certificates" ADD COLUMN "branch_id" UUID;
ALTER TABLE "system_settings" ADD COLUMN "branch_id" UUID;

UPDATE "users" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001'
WHERE "id" IN (
  SELECT ur."user_id" FROM "user_roles" ur
  JOIN "roles" r ON r."id" = ur."role_id"
  WHERE r."name" = 'INSTRUCTOR'
);

UPDATE "families" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "students" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "parents" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "instructors" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "courses" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "groups" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "student_feedback" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "enrollments" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "class_sessions" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "attendances" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "discounts" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "invoices" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "payments" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "instructor_compensation_rules" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "instructor_compensations" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "expenses" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "employment_contracts" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "certificates" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';
UPDATE "system_settings" SET "branch_id" = 'a1000000-0000-4000-8000-000000000001';

INSERT INTO "system_settings" (
  "id", "branch_id", "school_name", "currency", "email", "phone", "address",
  "multi_course_discount_percent", "family_pack_discount_percent", "invoice_due_day",
  "created_at", "updated_at"
)
SELECT
  'a2000000-0000-4000-8000-000000000010',
  'a2000000-0000-4000-8000-000000000002',
  'Unity Tech Hub Skenderaj',
  "currency", "email", "phone", "address",
  "multi_course_discount_percent", "family_pack_discount_percent", "invoice_due_day",
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "system_settings"
WHERE "branch_id" = 'a1000000-0000-4000-8000-000000000001';

ALTER TABLE "families" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "students" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "parents" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "instructors" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "courses" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "groups" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "student_feedback" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "enrollments" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "class_sessions" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "attendances" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "discounts" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "instructor_compensation_rules" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "instructor_compensations" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "expenses" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "employment_contracts" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "certificates" ALTER COLUMN "branch_id" SET NOT NULL;
ALTER TABLE "system_settings" ALTER COLUMN "branch_id" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "families" ADD CONSTRAINT "families_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "students" ADD CONSTRAINT "students_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "parents" ADD CONSTRAINT "parents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "courses" ADD CONSTRAINT "courses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "groups" ADD CONSTRAINT "groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_feedback" ADD CONSTRAINT "student_feedback_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "class_sessions" ADD CONSTRAINT "class_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "discounts" ADD CONSTRAINT "discounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructor_compensation_rules" ADD CONSTRAINT "instructor_compensation_rules_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "instructor_compensations" ADD CONSTRAINT "instructor_compensations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "users_branch_id_idx" ON "users"("branch_id");
CREATE INDEX "families_branch_id_idx" ON "families"("branch_id");
CREATE INDEX "students_branch_id_idx" ON "students"("branch_id");
CREATE INDEX "parents_branch_id_idx" ON "parents"("branch_id");
CREATE INDEX "instructors_branch_id_idx" ON "instructors"("branch_id");
CREATE INDEX "courses_branch_id_idx" ON "courses"("branch_id");
CREATE INDEX "groups_branch_id_idx" ON "groups"("branch_id");
CREATE INDEX "student_feedback_branch_id_idx" ON "student_feedback"("branch_id");
CREATE INDEX "enrollments_branch_id_idx" ON "enrollments"("branch_id");
CREATE INDEX "class_sessions_branch_id_idx" ON "class_sessions"("branch_id");
CREATE INDEX "attendances_branch_id_idx" ON "attendances"("branch_id");
CREATE INDEX "discounts_branch_id_idx" ON "discounts"("branch_id");
CREATE INDEX "invoices_branch_id_idx" ON "invoices"("branch_id");
CREATE INDEX "payments_branch_id_idx" ON "payments"("branch_id");
CREATE INDEX "instructor_compensation_rules_branch_id_idx" ON "instructor_compensation_rules"("branch_id");
CREATE INDEX "instructor_compensations_branch_id_idx" ON "instructor_compensations"("branch_id");
CREATE INDEX "expenses_branch_id_idx" ON "expenses"("branch_id");
CREATE INDEX "employment_contracts_branch_id_idx" ON "employment_contracts"("branch_id");
CREATE INDEX "certificates_branch_id_idx" ON "certificates"("branch_id");

CREATE UNIQUE INDEX "courses_branch_id_code_key" ON "courses"("branch_id", "code");
CREATE UNIQUE INDEX "discounts_branch_id_code_key" ON "discounts"("branch_id", "code");
CREATE UNIQUE INDEX "system_settings_branch_id_key" ON "system_settings"("branch_id");

DROP INDEX "courses_code_key";
DROP INDEX "discounts_code_key";

-- Remove the Admin role. Those accounts can no longer sign in.
UPDATE "users"
SET "status" = 'DISABLED', "deleted_at" = CURRENT_TIMESTAMP
WHERE "deleted_at" IS NULL
  AND "id" IN (
    SELECT ur."user_id" FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE r."name" = 'ADMIN'
  )
  AND "id" NOT IN (
    SELECT ur."user_id" FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE r."name" IN ('SUPER_ADMIN', 'INSTRUCTOR')
  );

UPDATE "refresh_tokens" SET "revoked_at" = CURRENT_TIMESTAMP
WHERE "revoked_at" IS NULL
  AND "user_id" IN (
    SELECT ur."user_id" FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
    WHERE r."name" = 'ADMIN'
  );

DELETE FROM "user_roles" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');
DELETE FROM "role_permissions" WHERE "role_id" IN (SELECT "id" FROM "roles" WHERE "name" = 'ADMIN');
DELETE FROM "roles" WHERE "name" = 'ADMIN';
