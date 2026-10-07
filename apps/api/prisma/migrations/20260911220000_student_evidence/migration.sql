-- CreateEnum
CREATE TYPE "StudentEvidenceType" AS ENUM ('NOTE', 'WORK_SAMPLE', 'ASSESSMENT', 'PROGRESS', 'OTHER');

-- CreateTable
CREATE TABLE "student_evidence" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "recorded_by_id" UUID NOT NULL,
    "type" "StudentEvidenceType" NOT NULL DEFAULT 'NOTE',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "url" TEXT,
    "evidence_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "student_evidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_evidence_group_id_student_id_idx" ON "student_evidence"("group_id", "student_id");
CREATE INDEX "student_evidence_student_id_idx" ON "student_evidence"("student_id");
CREATE INDEX "student_evidence_recorded_by_id_idx" ON "student_evidence"("recorded_by_id");
CREATE INDEX "student_evidence_evidence_date_idx" ON "student_evidence"("evidence_date");
CREATE INDEX "student_evidence_deleted_at_idx" ON "student_evidence"("deleted_at");

ALTER TABLE "student_evidence" ADD CONSTRAINT "student_evidence_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_evidence" ADD CONSTRAINT "student_evidence_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_evidence" ADD CONSTRAINT "student_evidence_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'evidence', 'read', 'View student evidence', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "resource" = 'evidence' AND "action" = 'read'
);

INSERT INTO "permissions" ("id", "resource", "action", "description", "created_at", "updated_at")
SELECT gen_random_uuid(), 'evidence', 'manage', 'Record and update student evidence', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "resource" = 'evidence' AND "action" = 'manage'
);

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.name IN ('SUPER_ADMIN', 'ADMIN', 'INSTRUCTOR')
  AND p.resource = 'evidence'
  AND p.action IN ('read', 'manage')
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permissions" rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
  );
