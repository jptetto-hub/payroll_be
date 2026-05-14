-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'STATUS_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'EXPORT';

-- CreateEnum
CREATE TYPE "AdvanceSettlementStatus" AS ENUM ('UNSETTLED', 'PARTIALLY_SETTLED', 'SETTLED', 'CARRY_FORWARDED');

-- CreateEnum
CREATE TYPE "CarryForwardStatus" AS ENUM ('PENDING', 'PARTIALLY_DEDUCTED', 'DEDUCTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SalaryHistory" ADD COLUMN "lockedFromPayrollId" TEXT;

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "lockedByPayrollId" TEXT;

-- AlterTable
ALTER TABLE "AdvancePayment" ADD COLUMN "settledAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "carryForwardAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "settlementStatus" "AdvanceSettlementStatus" NOT NULL DEFAULT 'UNSETTLED',
ADD COLUMN "lockedByPayrollId" TEXT;

-- AlterTable
ALTER TABLE "Payroll" ADD COLUMN "carryForwardApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "totalDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "rawFinalSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "carryForwardDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancelledById" TEXT,
ADD COLUMN "cancelReason" TEXT;

-- CreateTable
CREATE TABLE "PayrollCarryForward" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "sourcePayrollId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "remainingAmount" DECIMAL(12,2) NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "cycleEndDate" TIMESTAMP(3) NOT NULL,
    "status" "CarryForwardStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollCarryForward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryHistory_lockedFromPayrollId_idx" ON "SalaryHistory"("lockedFromPayrollId");

-- CreateIndex
CREATE INDEX "Attendance_lockedByPayrollId_idx" ON "Attendance"("lockedByPayrollId");

-- CreateIndex
CREATE INDEX "AdvancePayment_settlementStatus_idx" ON "AdvancePayment"("settlementStatus");

-- CreateIndex
CREATE INDEX "AdvancePayment_lockedByPayrollId_idx" ON "AdvancePayment"("lockedByPayrollId");

-- CreateIndex
CREATE INDEX "Payroll_cancelledById_idx" ON "Payroll"("cancelledById");

-- CreateIndex
CREATE INDEX "PayrollCarryForward_employeeId_idx" ON "PayrollCarryForward"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollCarryForward_sourcePayrollId_idx" ON "PayrollCarryForward"("sourcePayrollId");

-- CreateIndex
CREATE INDEX "PayrollCarryForward_status_idx" ON "PayrollCarryForward"("status");

-- CreateIndex
CREATE INDEX "PayrollCarryForward_cycleStartDate_cycleEndDate_idx" ON "PayrollCarryForward"("cycleStartDate", "cycleEndDate");

-- AddForeignKey
ALTER TABLE "PayrollCarryForward" ADD CONSTRAINT "PayrollCarryForward_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCarryForward" ADD CONSTRAINT "PayrollCarryForward_sourcePayrollId_fkey" FOREIGN KEY ("sourcePayrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
