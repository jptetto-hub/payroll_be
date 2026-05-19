-- Extend audit action enum for enterprise audit coverage.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_CANCEL';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VALIDATION_FAILED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FAILED';

-- Add enterprise audit columns. Keep nullable to preserve immutable history.
ALTER TABLE "AuditLog"
ADD COLUMN IF NOT EXISTS "employeeId" TEXT,
ADD COLUMN IF NOT EXISTS "entityId" TEXT,
ADD COLUMN IF NOT EXISTS "description" TEXT,
ADD COLUMN IF NOT EXISTS "status" TEXT,
ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
ADD COLUMN IF NOT EXISTS "deviceInfo" TEXT,
ADD COLUMN IF NOT EXISTS "requestId" TEXT,
ADD COLUMN IF NOT EXISTS "sessionId" TEXT;

-- Add relation for the affected employee/entity when available.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AuditLog_employeeId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
    ADD CONSTRAINT "AuditLog_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes for filtering/search and high-volume audit browsing.
CREATE INDEX IF NOT EXISTS "AuditLog_employeeId_idx" ON "AuditLog"("employeeId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_status_idx" ON "AuditLog"("status");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
