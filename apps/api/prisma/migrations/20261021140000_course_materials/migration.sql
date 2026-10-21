CREATE TYPE "MaterialStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');
CREATE TYPE "MaterialDecision" AS ENUM ('APPROVED', 'REJECTED');
CREATE TYPE "MaterialReviewerRole" AS ENUM ('INSTRUCTOR', 'SUPER_ADMIN');

CREATE TABLE "course_material_topics" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_material_topics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_materials" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_body" TEXT,
    "status" "MaterialStatus" NOT NULL DEFAULT 'PENDING',
    "author_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "course_materials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "course_material_reviews" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "reviewer_user_id" UUID NOT NULL,
    "reviewer_role" "MaterialReviewerRole" NOT NULL,
    "decision" "MaterialDecision" NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_material_reviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_material_topics_branch_id_idx" ON "course_material_topics"("branch_id");
CREATE INDEX "course_material_topics_course_id_idx" ON "course_material_topics"("course_id");
CREATE INDEX "course_material_topics_deleted_at_idx" ON "course_material_topics"("deleted_at");

CREATE INDEX "course_materials_branch_id_idx" ON "course_materials"("branch_id");
CREATE INDEX "course_materials_topic_id_idx" ON "course_materials"("topic_id");
CREATE INDEX "course_materials_status_idx" ON "course_materials"("status");
CREATE INDEX "course_materials_deleted_at_idx" ON "course_materials"("deleted_at");

CREATE UNIQUE INDEX "course_material_reviews_material_id_reviewer_user_id_key" ON "course_material_reviews"("material_id", "reviewer_user_id");
CREATE INDEX "course_material_reviews_branch_id_idx" ON "course_material_reviews"("branch_id");
CREATE INDEX "course_material_reviews_reviewer_user_id_idx" ON "course_material_reviews"("reviewer_user_id");

ALTER TABLE "course_material_topics" ADD CONSTRAINT "course_material_topics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_material_topics" ADD CONSTRAINT "course_material_topics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_material_topics" ADD CONSTRAINT "course_material_topics_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "course_material_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_materials" ADD CONSTRAINT "course_materials_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "course_material_reviews" ADD CONSTRAINT "course_material_reviews_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_material_reviews" ADD CONSTRAINT "course_material_reviews_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "course_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_material_reviews" ADD CONSTRAINT "course_material_reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
