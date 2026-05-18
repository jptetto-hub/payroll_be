-- CreateEnum
ALTER TYPE "LedgerType" ADD VALUE IF NOT EXISTS 'OVERTIME';

-- AlterTable
ALTER TABLE "Attendance"
ADD COLUMN IF NOT EXISTS "checkInTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "checkOutTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "otStartTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "otEndTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "otHours" DECIMAL(7,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "otOverrideReason" TEXT,
ADD COLUMN IF NOT EXISTS "otBreakdown" JSONB;

-- AlterTable
ALTER TABLE "AttendanceRequest"
ADD COLUMN IF NOT EXISTS "requestedCheckInTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requestedCheckOutTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requestedOtStartTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requestedOtEndTime" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requestedOtHours" DECIMAL(7,2),
ADD COLUMN IF NOT EXISTS "requestedOtManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "requestedOtOverrideReason" TEXT;

-- AlterTable
ALTER TABLE "Payroll"
ADD COLUMN IF NOT EXISTS "standardSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otTotalHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otHourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "overtimeBreakdown" JSONB;

UPDATE "Payroll"
SET "standardSalary" = "grossSalary"
WHERE "standardSalary" = 0;

-- AlterTable
ALTER TABLE "Payslip"
ADD COLUMN IF NOT EXISTS "standardSalary" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otTotalHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otHourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "otEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "overtimeBreakdown" JSONB;

UPDATE "Payslip"
SET "standardSalary" = "finalSalary"
WHERE "standardSalary" = 0;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WorkHourSetting" (
  "id" TEXT NOT NULL,
  "workStartTime" TEXT NOT NULL,
  "workEndTime" TEXT NOT NULL,
  "standardMinutes" INTEGER NOT NULL,
  "effectiveFromDate" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WorkHourSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkHourSetting_effectiveFromDate_key" ON "WorkHourSetting"("effectiveFromDate");
CREATE INDEX IF NOT EXISTS "WorkHourSetting_effectiveFromDate_idx" ON "WorkHourSetting"("effectiveFromDate");
CREATE INDEX IF NOT EXISTS "WorkHourSetting_isActive_idx" ON "WorkHourSetting"("isActive");

-- Seed default work hours if no historical work-hour setting exists.
INSERT INTO "WorkHourSetting" (
  "id",
  "workStartTime",
  "workEndTime",
  "standardMinutes",
  "effectiveFromDate",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'default-work-hour-setting',
  '09:00',
  '17:00',
  480,
  TIMESTAMP '2000-01-01 00:00:00.000',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "WorkHourSetting");
