-- Defaults preserve every existing attendance and payroll record.
ALTER TABLE "Attendance"
ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payroll"
ADD COLUMN IF NOT EXISTS "lateMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "lateDeduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
