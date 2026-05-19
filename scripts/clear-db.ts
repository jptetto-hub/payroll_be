import { prisma } from "../src/config/prisma";

async function clearDatabase() {
  await prisma.$transaction([
    prisma.payslip.deleteMany(),
    prisma.payrollCarryForward.deleteMany(),
    prisma.ledgerEntry.deleteMany(),
    prisma.payroll.deleteMany(),
    prisma.advancePayment.deleteMany(),
    prisma.attendanceRequest.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.salaryHistory.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.workHourSetting.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.schedulerRun.deleteMany(),
  ]);

  console.log("Database cleared successfully");
}

clearDatabase()
  .catch((error) => {
    console.error("Error clearing database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
