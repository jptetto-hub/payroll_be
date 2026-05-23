-- Payslip background generation status tracking.
CREATE TYPE "PayslipStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

ALTER TABLE "Payslip"
  ADD COLUMN "status" "PayslipStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3),
  ADD COLUMN "errorMessage" TEXT;

UPDATE "Payslip"
SET "pdfGeneratedAt" = COALESCE("pdfGeneratedAt", "createdAt")
WHERE "status" = 'READY';

ALTER TABLE "Payslip"
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP INDEX IF EXISTS "Payslip_payrollId_idx";
CREATE UNIQUE INDEX "Payslip_payrollId_key" ON "Payslip"("payrollId");
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");
CREATE INDEX "Payslip_status_createdAt_idx" ON "Payslip"("status", "createdAt");
