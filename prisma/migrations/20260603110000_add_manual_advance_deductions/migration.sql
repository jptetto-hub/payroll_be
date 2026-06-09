-- CreateEnum
CREATE TYPE "AdvanceDeductionMode" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Employee"
ADD COLUMN "advanceDeductionMode" "AdvanceDeductionMode" NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "AdvanceManualDeduction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "salaryType" "SalaryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "lockedByPayrollId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvanceManualDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvanceManualDeduction_employeeId_periodStart_periodEnd_key"
ON "AdvanceManualDeduction"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AdvanceManualDeduction_employeeId_periodStart_periodEnd_idx"
ON "AdvanceManualDeduction"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "AdvanceManualDeduction_lockedByPayrollId_idx"
ON "AdvanceManualDeduction"("lockedByPayrollId");

-- CreateIndex
CREATE INDEX "AdvanceManualDeduction_createdAt_idx"
ON "AdvanceManualDeduction"("createdAt");

-- AddForeignKey
ALTER TABLE "AdvanceManualDeduction"
ADD CONSTRAINT "AdvanceManualDeduction_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvanceManualDeduction"
ADD CONSTRAINT "AdvanceManualDeduction_lockedByPayrollId_fkey"
FOREIGN KEY ("lockedByPayrollId") REFERENCES "Payroll"("id") ON DELETE SET NULL ON UPDATE CASCADE;
