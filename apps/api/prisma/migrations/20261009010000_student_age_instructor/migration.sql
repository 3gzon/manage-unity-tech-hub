ALTER TABLE "students" ADD COLUMN "age" INTEGER;
ALTER TABLE "students" ADD COLUMN "instructor_id" UUID;

ALTER TABLE "students"
ADD CONSTRAINT "students_instructor_id_fkey"
FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "students_instructor_id_idx" ON "students"("instructor_id");
