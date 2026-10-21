CREATE TYPE "MaterialCommentKind" AS ENUM ('NOTE', 'CHANGE');

CREATE TABLE "course_material_comments" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "kind" "MaterialCommentKind" NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_material_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "course_material_comments_branch_id_idx" ON "course_material_comments"("branch_id");
CREATE INDEX "course_material_comments_material_id_idx" ON "course_material_comments"("material_id");
CREATE INDEX "course_material_comments_author_user_id_idx" ON "course_material_comments"("author_user_id");

ALTER TABLE "course_material_comments" ADD CONSTRAINT "course_material_comments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_material_comments" ADD CONSTRAINT "course_material_comments_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "course_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_material_comments" ADD CONSTRAINT "course_material_comments_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
