CREATE TYPE "EmploymentContractType" AS ENUM ('INDEFINITE', 'FIXED_TERM', 'SPECIFIC_TASK');
CREATE TYPE "EmploymentContractStatus" AS ENUM ('DRAFT', 'ISSUED', 'ACTIVE', 'EXPIRED', 'TERMINATED');
CREATE TYPE "EmploymentTimeType" AS ENUM ('FULL_TIME', 'PART_TIME');

CREATE TABLE "employment_contracts" (
    "id" UUID NOT NULL,
    "contract_number" TEXT NOT NULL,
    "employee_user_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "type" "EmploymentContractType" NOT NULL,
    "status" "EmploymentContractStatus" NOT NULL DEFAULT 'DRAFT',
    "time_type" "EmploymentTimeType" NOT NULL DEFAULT 'FULL_TIME',
    "employer_name" TEXT NOT NULL,
    "employer_seat" TEXT NOT NULL,
    "employer_registration_number" TEXT NOT NULL,
    "employee_first_name" TEXT NOT NULL,
    "employee_last_name" TEXT NOT NULL,
    "employee_qualification" TEXT NOT NULL,
    "employee_residence" TEXT NOT NULL,
    "employee_personal_number" TEXT,
    "job_title" TEXT NOT NULL,
    "job_nature" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "workplace" TEXT NOT NULL,
    "work_in_multiple_locations" BOOLEAN NOT NULL DEFAULT false,
    "weekly_hours" INTEGER NOT NULL,
    "work_schedule" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "allowances" TEXT,
    "payment_day" INTEGER,
    "annual_leave_days" INTEGER NOT NULL DEFAULT 20,
    "notice_period_days" INTEGER NOT NULL,
    "termination_terms" TEXT,
    "probation_months" INTEGER NOT NULL DEFAULT 0,
    "agreed_terms" TEXT,
    "notes" TEXT,
    "issued_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "terminated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "employment_contracts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employment_contracts_contract_number_key" ON "employment_contracts"("contract_number");
CREATE INDEX "employment_contracts_employee_user_id_idx" ON "employment_contracts"("employee_user_id");
CREATE INDEX "employment_contracts_status_idx" ON "employment_contracts"("status");
CREATE INDEX "employment_contracts_type_idx" ON "employment_contracts"("type");
CREATE INDEX "employment_contracts_deleted_at_idx" ON "employment_contracts"("deleted_at");

ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_employee_user_id_fkey" FOREIGN KEY ("employee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employment_contracts" ADD CONSTRAINT "employment_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
