DELETE FROM "role_permissions"
WHERE "permission_id" IN (
  SELECT "id" FROM "permissions" WHERE "resource" = 'evidence'
);

DELETE FROM "permissions" WHERE "resource" = 'evidence';

DROP TABLE IF EXISTS "student_evidence";

DROP TYPE IF EXISTS "StudentEvidenceType";
