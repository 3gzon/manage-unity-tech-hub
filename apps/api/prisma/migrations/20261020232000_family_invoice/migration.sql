CREATE TABLE "invoice_students" (
    "invoice_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,

    CONSTRAINT "invoice_students_pkey" PRIMARY KEY ("invoice_id","student_id")
);

CREATE INDEX "invoice_students_student_id_idx" ON "invoice_students"("student_id");

ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_students" ADD CONSTRAINT "invoice_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
