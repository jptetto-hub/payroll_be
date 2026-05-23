-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN "activePayrollKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_activePayrollKey_key" ON "Payroll"("activePayrollKey");
