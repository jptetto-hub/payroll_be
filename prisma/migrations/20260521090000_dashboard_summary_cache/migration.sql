-- CreateEnum
CREATE TYPE "DashboardSummaryType" AS ENUM ('GLOBAL', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "DashboardSummary" (
    "id" TEXT NOT NULL,
    "summaryKey" TEXT NOT NULL,
    "type" "DashboardSummaryType" NOT NULL,
    "employeeId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "activeEmployees" INTEGER NOT NULL DEFAULT 0,
    "inactiveEmployees" INTEGER NOT NULL DEFAULT 0,
    "pendingAttendanceRequests" INTEGER NOT NULL DEFAULT 0,
    "approvedAttendanceRequests" INTEGER NOT NULL DEFAULT 0,
    "rejectedAttendanceRequests" INTEGER NOT NULL DEFAULT 0,
    "generatedPayrolls" INTEGER NOT NULL DEFAULT 0,
    "paidPayrolls" INTEGER NOT NULL DEFAULT 0,
    "cancelledPayrolls" INTEGER NOT NULL DEFAULT 0,
    "grossSalaryTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "advanceDeductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "finalSalaryTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstandingAdvanceTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ledgerSalaryTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ledgerAdvanceTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ledgerDeductionTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ledgerAdjustmentTotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardSummary_summaryKey_key" ON "DashboardSummary"("summaryKey");

-- CreateIndex
CREATE INDEX "DashboardSummary_type_idx" ON "DashboardSummary"("type");

-- CreateIndex
CREATE INDEX "DashboardSummary_employeeId_idx" ON "DashboardSummary"("employeeId");

-- CreateIndex
CREATE INDEX "DashboardSummary_periodStart_periodEnd_idx" ON "DashboardSummary"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "DashboardSummary_calculatedAt_idx" ON "DashboardSummary"("calculatedAt");

-- AddForeignKey
ALTER TABLE "DashboardSummary" ADD CONSTRAINT "DashboardSummary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
