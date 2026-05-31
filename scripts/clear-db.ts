import { prisma } from "../src/config/prisma";

const REQUIRED_CONFIRMATION = "CLEAR_PAYROLL_DATABASE";

const BUSINESS_TABLES = [
  "Payslip",
  "PayrollCarryForward",
  "LedgerEntry",
  "SchedulerRunItem",
  "Payroll",
  "AdvancePayment",
  "AttendanceRequest",
  "Attendance",
  "SalaryHistory",
  "DashboardSummary",
  "AuditLog",
  "AuditLogArchive",
  "Employee",
  "WorkHourSetting",
  "SystemSetting",
  "SchedulerRun",
  "WorkerHeartbeat",
];

function assertClearAllowed() {
  if (process.env.CONFIRM_DB_CLEAR !== REQUIRED_CONFIRMATION) {
    throw new Error(
      `Database clear blocked. Set CONFIRM_DB_CLEAR=${REQUIRED_CONFIRMATION}`,
    );
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_PRODUCTION_DB_CLEAR !== "true"
  ) {
    throw new Error(
      "Production database clear blocked. Set ALLOW_PRODUCTION_DB_CLEAR=true only during an approved maintenance window.",
    );
  }
}

function describeDatabaseTarget() {
  if (!process.env.DATABASE_URL) {
    return "(DATABASE_URL is missing)";
  }

  const url = new URL(process.env.DATABASE_URL);
  const database = url.pathname.replace(/^\//, "") || "(default)";

  return `${url.hostname}:${url.port || "5432"}/${database}`;
}

async function clearDatabase() {
  assertClearAllowed();

  console.log(`Clearing business data from ${describeDatabaseTarget()}...`);

  const quotedTableNames = BUSINESS_TABLES.map((table) => `"${table}"`).join(
    ", ",
  );

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTableNames} RESTART IDENTITY CASCADE;`,
  );

  console.log("Database business tables cleared successfully");
  console.log("Restart API and worker services, then clear stale Redis queue jobs.");
}

clearDatabase()
  .catch((error) => {
    console.error("Error clearing database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
