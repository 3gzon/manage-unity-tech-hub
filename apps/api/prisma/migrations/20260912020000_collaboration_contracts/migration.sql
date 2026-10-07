ALTER TYPE "EmploymentContractType" ADD VALUE 'COLLABORATION';

ALTER TABLE "employment_contracts" ADD COLUMN "collaboration_percentage" DECIMAL(5,2);
ALTER TABLE "employment_contracts" ADD COLUMN "percentage_base" TEXT;
