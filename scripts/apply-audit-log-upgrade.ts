import { prisma } from "../src/config/prisma";

const statements = [
  `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'LOGOUT'`,
  `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PAYROLL_CANCEL'`,
  `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UNAUTHORIZED'`,
  `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'VALIDATION_FAILED'`,
  `ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'FAILED'`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "employeeId" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityId" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "description" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "status" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "deviceInfo" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" TEXT`,
  `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "sessionId" TEXT`,
  `
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
  END $$
  `,
  `CREATE INDEX IF NOT EXISTS "AuditLog_employeeId_idx" ON "AuditLog"("employeeId")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_entityId_idx" ON "AuditLog"("entityId")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_status_idx" ON "AuditLog"("status")`,
  `CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt")`,
];

async function main() {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  const columns = await prisma.$queryRawUnsafe<
    { column_name: string }[]
  >(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'AuditLog'
      AND column_name IN (
        'employeeId',
        'entityId',
        'description',
        'status',
        'userAgent',
        'deviceInfo',
        'requestId',
        'sessionId'
      )
    ORDER BY column_name
  `);

  console.log(
    "Audit log upgrade applied. Columns:",
    columns.map((item) => item.column_name).join(", "),
  );
}

main()
  .catch((error) => {
    console.error("Audit log upgrade failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
