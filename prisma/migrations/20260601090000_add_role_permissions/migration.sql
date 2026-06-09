ALTER TABLE "SystemSetting"
ADD COLUMN "rolePermissions" JSONB NOT NULL DEFAULT '{}';
