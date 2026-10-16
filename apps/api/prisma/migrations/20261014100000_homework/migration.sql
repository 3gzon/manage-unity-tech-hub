CREATE TABLE "homework" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "due_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "homework_completions" (
    "id" UUID NOT NULL,
    "homework_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "homework_completions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "homework_group_id_idx" ON "homework"("group_id");
CREATE INDEX "homework_deleted_at_idx" ON "homework"("deleted_at");
CREATE UNIQUE INDEX "homework_completions_homework_id_student_id_key" ON "homework_completions"("homework_id", "student_id");
CREATE INDEX "homework_completions_student_id_idx" ON "homework_completions"("student_id");

ALTER TABLE "homework" ADD CONSTRAINT "homework_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_completions" ADD CONSTRAINT "homework_completions_homework_id_fkey" FOREIGN KEY ("homework_id") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_completions" ADD CONSTRAINT "homework_completions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
