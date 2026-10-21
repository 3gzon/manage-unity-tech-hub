CREATE TABLE "student_feedback" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "instructor_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "overall" TEXT NOT NULL,
    "participation" TEXT NOT NULL,
    "understanding" TEXT NOT NULL,
    "practice" TEXT NOT NULL,
    "attendance" TEXT NOT NULL,
    "strengths" TEXT NOT NULL,
    "improvements" TEXT NOT NULL,
    "next_steps" TEXT NOT NULL,
    "sent_to" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_feedback_student_id_idx" ON "student_feedback"("student_id");
CREATE INDEX "student_feedback_instructor_id_idx" ON "student_feedback"("instructor_id");
CREATE INDEX "student_feedback_group_id_idx" ON "student_feedback"("group_id");
CREATE INDEX "student_feedback_created_at_idx" ON "student_feedback"("created_at");

ALTER TABLE "student_feedback" ADD CONSTRAINT "student_feedback_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_feedback" ADD CONSTRAINT "student_feedback_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "student_feedback" ADD CONSTRAINT "student_feedback_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
