-- Add async scheduler run status/progress tracking.
CREATE TYPE "SchedulerRunStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'PARTIAL_SUCCESS'
);

CREATE TYPE "SchedulerRunItemStatus" AS ENUM (
  'SUCCESS',
  'SKIPPED',
  'FAILED'
);

ALTER TABLE "SchedulerRun"
  RENAME COLUMN "finishedAt" TO "completedAt";

ALTER TABLE "SchedulerRun"
  ADD COLUMN "status" "SchedulerRunStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "totalEmployees" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processedEmployees" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "successCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skippedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "startedAt" DROP NOT NULL;

UPDATE "SchedulerRun"
SET "status" = CASE
  WHEN "completedAt" IS NULL THEN 'RUNNING'::"SchedulerRunStatus"
  WHEN "success" = true THEN 'COMPLETED'::"SchedulerRunStatus"
  ELSE 'FAILED'::"SchedulerRunStatus"
END;

CREATE TABLE "SchedulerRunItem" (
  "id" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "employeeId" TEXT,
  "employeeCode" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "status" "SchedulerRunItemStatus" NOT NULL,
  "reason" TEXT,
  "errorMessage" TEXT,
  "payrollId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SchedulerRunItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SchedulerRunItem"
  ADD CONSTRAINT "SchedulerRunItem_runId_fkey"
  FOREIGN KEY ("runId") REFERENCES "SchedulerRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SchedulerRun_status_idx" ON "SchedulerRun"("status");
CREATE INDEX "SchedulerRun_createdAt_idx" ON "SchedulerRun"("createdAt");
CREATE INDEX "SchedulerRun_name_createdAt_idx" ON "SchedulerRun"("name", "createdAt");
CREATE INDEX "SchedulerRunItem_runId_idx" ON "SchedulerRunItem"("runId");
CREATE INDEX "SchedulerRunItem_employeeId_idx" ON "SchedulerRunItem"("employeeId");
CREATE INDEX "SchedulerRunItem_status_idx" ON "SchedulerRunItem"("status");
CREATE INDEX "SchedulerRunItem_createdAt_idx" ON "SchedulerRunItem"("createdAt");

DROP INDEX IF EXISTS "SchedulerRun_name_idx";
DROP INDEX IF EXISTS "SchedulerRun_success_idx";
ALTER TABLE "SchedulerRun" DROP COLUMN "success";
