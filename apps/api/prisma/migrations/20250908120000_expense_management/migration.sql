-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- AlterTable
ALTER TABLE "expenses"
    ADD COLUMN "payment_method" "PaymentMethod",
    ADD COLUMN "notes" TEXT,
    ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "voided_at" TIMESTAMP(3);

CREATE INDEX "expenses_status_idx" ON "expenses"("status");
