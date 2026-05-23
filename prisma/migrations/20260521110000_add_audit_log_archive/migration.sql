-- CreateTable
CREATE TABLE "AuditLogArchive" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "description" TEXT,
    "status" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "requestId" TEXT,
    "sessionId" TEXT,
    "originalCreatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLogArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLogArchive_userId_idx" ON "AuditLogArchive"("userId");

-- CreateIndex
CREATE INDEX "AuditLogArchive_employeeId_idx" ON "AuditLogArchive"("employeeId");

-- CreateIndex
CREATE INDEX "AuditLogArchive_module_idx" ON "AuditLogArchive"("module");

-- CreateIndex
CREATE INDEX "AuditLogArchive_action_idx" ON "AuditLogArchive"("action");

-- CreateIndex
CREATE INDEX "AuditLogArchive_status_idx" ON "AuditLogArchive"("status");

-- CreateIndex
CREATE INDEX "AuditLogArchive_originalCreatedAt_idx" ON "AuditLogArchive"("originalCreatedAt");

-- CreateIndex
CREATE INDEX "AuditLogArchive_archivedAt_idx" ON "AuditLogArchive"("archivedAt");
