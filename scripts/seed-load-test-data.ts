import {
  AttendanceStatus,
  EmployeeStatus,
  LedgerType,
  PayrollStatus,
  PayslipStatus,
  Prisma,
  Role,
  SalaryType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";
import { buildActivePayrollKey } from "../src/utils/payrollKey";

const EMPLOYEE_COUNT = Number(process.env.SEED_EMPLOYEE_COUNT || 100);
const BATCH_SIZE = Number(process.env.SEED_BATCH_SIZE || 1000);
const ATTENDANCE_EMPLOYEE_BATCH_SIZE = Number(
  process.env.SEED_ATTENDANCE_EMPLOYEE_BATCH_SIZE || 100,
);
const PAYROLL_EMPLOYEE_BATCH_SIZE = Number(
  process.env.SEED_PAYROLL_EMPLOYEE_BATCH_SIZE || 10,
);
const PASSWORD = process.env.SEED_PASSWORD || "Password@123";
const SUPER_ADMIN_PHONE = process.env.SEED_SUPER_ADMIN_PHONE || "9999999999";
const SUPER_ADMIN_CODE = process.env.SEED_SUPER_ADMIN_CODE || "SUPERADMIN";
const LOAD_EMPLOYEE_PREFIX = process.env.SEED_EMPLOYEE_PREFIX || "EMP";
const LOAD_EFFECTIVE_FROM = new Date(
  process.env.SEED_START_DATE || "2024-05-01T00:00:00.000Z",
);
const PAYROLL_MONTHS = Number(process.env.SEED_PAYROLL_MONTHS || 24);
const BASE_MONTHLY_SALARY = Number(
  process.env.SEED_BASE_MONTHLY_SALARY || 30000,
);

function pad(num: number, size = 6) {
  return String(num).padStart(size, "0");
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function endOfMonth(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  );
}

function toUtcDate(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getWorkingDatesBetween(from: Date, to: Date) {
  const dates: Date[] = [];
  let cursor = toUtcDate(from);
  const end = toUtcDate(to);

  while (cursor <= end) {
    if (cursor.getUTCDay() !== 0) {
      dates.push(new Date(cursor));
    }

    cursor = addDays(cursor, 1);
  }

  return dates;
}

function getAttendanceStatus(employeeIndex: number, date: Date) {
  const dayOfMonth = date.getUTCDate();
  const month = date.getUTCMonth() + 1;

  if ((employeeIndex + dayOfMonth + month) % 29 === 0) {
    return AttendanceStatus.ABSENT;
  }

  if ((employeeIndex + dayOfMonth) % 17 === 0) {
    return AttendanceStatus.HALF_DAY;
  }

  return AttendanceStatus.PRESENT;
}

function getAttendanceValue(status: AttendanceStatus) {
  if (status === AttendanceStatus.PRESENT) return 1;
  if (status === AttendanceStatus.HALF_DAY) return 0.5;
  return 0;
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

function calculatePayrollSnapshot(params: {
  employeeIndex: number;
  salaryHistoryId: string;
  monthlySalary: number;
  periodStart: Date;
  periodEnd: Date;
}) {
  const workingDates = getWorkingDatesBetween(
    params.periodStart,
    params.periodEnd,
  );
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let attendedDays = 0;
  let otTotalHours = 0;

  for (const date of workingDates) {
    const status = getAttendanceStatus(params.employeeIndex, date);

    if (status === AttendanceStatus.PRESENT) presentDays += 1;
    if (status === AttendanceStatus.ABSENT) absentDays += 1;
    if (status === AttendanceStatus.HALF_DAY) halfDays += 1;

    attendedDays += getAttendanceValue(status);

    if (
      status === AttendanceStatus.PRESENT &&
      (params.employeeIndex + date.getUTCDate()) % 11 === 0
    ) {
      otTotalHours = roundMoney(otTotalHours + 2);
    }
  }

  const workingDays = workingDates.length;
  const perDaySalary = roundMoney(params.monthlySalary / workingDays);
  const standardSalary = roundMoney(perDaySalary * attendedDays);
  const otHourlyRate = roundMoney(perDaySalary / 8);
  const otEarnings = roundMoney(otTotalHours * otHourlyRate);
  const grossSalary = roundMoney(standardSalary + otEarnings);
  const salaryBreakdown = [
    {
      salaryHistoryId: params.salaryHistoryId,
      salaryAmount: params.monthlySalary,
      segmentStart: formatDate(params.periodStart),
      segmentEnd: formatDate(params.periodEnd),
      workingDays,
      presentDays,
      halfDays,
      absentDays,
      missingDays: 0,
      attendedDays,
      perDaySalary,
      standardSalary,
      otHours: otTotalHours,
      otHourlyRate,
      otEarnings,
      grossSalary,
    },
  ];
  const attendanceBreakdown = {
    workingDays,
    presentDays,
    halfDays,
    absentDays,
    missingDays: 0,
    attendedDays,
    otTotalHours,
    otEarnings,
    effectivePeriodStart: formatDate(params.periodStart),
    effectivePeriodEnd: formatDate(params.periodEnd),
    joinedDuringCycle: false,
  };
  const overtimeBreakdown = {
    otTotalHours,
    otHourlyRate,
    otEarnings,
    segments: salaryBreakdown.map((item) => ({
      salaryHistoryId: item.salaryHistoryId,
      segmentStart: item.segmentStart,
      segmentEnd: item.segmentEnd,
      otHours: item.otHours,
      otHourlyRate: item.otHourlyRate,
      otEarnings: item.otEarnings,
    })),
  };

  return {
    workingDays,
    presentDays,
    absentDays,
    halfDays,
    standardSalary,
    otTotalHours,
    otHourlyRate,
    otEarnings,
    grossSalary,
    finalSalary: grossSalary,
    salaryBreakdown,
    attendanceBreakdown,
    advanceBreakdown: {
      advances: [],
      advanceDeduction: 0,
      carryForwardApplied: {
        pendingCarryForwards: [],
        appliedCarryForwards: [],
        carryForwardApplied: 0,
      },
    },
    overtimeBreakdown,
  };
}

async function main() {
  console.log(
    `Seeding ${EMPLOYEE_COUNT} employees with ${PAYROLL_MONTHS} months of attendance, payroll, payslips, and ledger data...`,
  );

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await prisma.employee.upsert({
    where: { phone: SUPER_ADMIN_PHONE },
    update: {
      password: passwordHash,
      role: Role.SUPER_ADMIN,
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      employeeCode: SUPER_ADMIN_CODE,
      name: "Load Test Super Admin",
      phone: SUPER_ADMIN_PHONE,
      password: passwordHash,
      role: Role.SUPER_ADMIN,
      salaryType: SalaryType.MONTHLY,
      status: EmployeeStatus.ACTIVE,
      joiningDate: LOAD_EFFECTIVE_FROM,
    },
  });

  await prisma.systemSetting.upsert({
    where: { id: "default-settings" },
    update: {
      weekStartsOn: "MONDAY",
      autoPayrollEnabled: true,
    },
    create: {
      id: "default-settings",
      weekStartsOn: "MONDAY",
      autoPayrollEnabled: true,
    },
  });

  await prisma.workHourSetting.upsert({
    where: { effectiveFromDate: LOAD_EFFECTIVE_FROM },
    update: {
      workStartTime: "09:00",
      workEndTime: "18:00",
      standardMinutes: 480,
      isActive: true,
    },
    create: {
      workStartTime: "09:00",
      workEndTime: "18:00",
      standardMinutes: 480,
      effectiveFromDate: LOAD_EFFECTIVE_FROM,
      isActive: true,
      note: "Default load-test work hours",
    },
  });

  for (let start = 1; start <= EMPLOYEE_COUNT; start += BATCH_SIZE) {
    const end = Math.min(start + BATCH_SIZE - 1, EMPLOYEE_COUNT);
    const now = new Date();
    const employees = [];

    for (let i = start; i <= end; i += 1) {
      employees.push({
        employeeCode: `${LOAD_EMPLOYEE_PREFIX}${pad(i)}`,
        name: `Load Test Employee ${i}`,
        phone: `8${pad(i, 9)}`,
        password: passwordHash,
        role: Role.USER,
        salaryType: SalaryType.MONTHLY,
        status: EmployeeStatus.ACTIVE,
        joiningDate: LOAD_EFFECTIVE_FROM,
        designation: `Operator Level ${(i % 5) + 1}`,
        department: ["Production", "Assembly", "Quality", "Stores"][i % 4],
        createdAt: now,
        updatedAt: now,
      });
    }

    await prisma.employee.createMany({
      data: employees,
      skipDuplicates: true,
    });

    console.log(`Employees inserted: ${end}/${EMPLOYEE_COUNT}`);
  }

  console.log("Fetching load-test employee ids...");

  const employees = await prisma.employee.findMany({
    where: {
      role: Role.USER,
      employeeCode: {
        startsWith: LOAD_EMPLOYEE_PREFIX,
      },
    },
    select: {
      id: true,
      salaryType: true,
      employeeCode: true,
      name: true,
    },
    take: EMPLOYEE_COUNT,
    orderBy: {
      employeeCode: "asc",
    },
  });

  console.log("Seeding salary history...");

  for (let start = 0; start < employees.length; start += BATCH_SIZE) {
    const batch = employees.slice(start, start + BATCH_SIZE);
    const existingSalaryRows = await prisma.salaryHistory.findMany({
      where: {
        employeeId: {
          in: batch.map((employee) => employee.id),
        },
        effectiveFrom: LOAD_EFFECTIVE_FROM,
      },
      select: {
        employeeId: true,
      },
    });
    const existingEmployeeIds = new Set(
      existingSalaryRows.map((row) => row.employeeId),
    );
    const now = new Date();

    await prisma.salaryHistory.createMany({
      data: batch
        .filter((employee) => !existingEmployeeIds.has(employee.id))
        .map((employee, index) => ({
          employeeId: employee.id,
          salaryAmount: BASE_MONTHLY_SALARY + start + index,
          effectiveFrom: LOAD_EFFECTIVE_FROM,
          createdAt: now,
          updatedAt: now,
        })),
    });

    console.log(
      `Salary history checked: ${Math.min(start + BATCH_SIZE, employees.length)}/${employees.length}`,
    );
  }

  const startDate = toUtcDate(LOAD_EFFECTIVE_FROM);
  const payrollPeriods = Array.from({ length: PAYROLL_MONTHS }, (_, index) => {
    const periodStart = addMonths(startDate, index);
    return {
      periodStart,
      periodEnd: endOfMonth(periodStart),
    };
  });
  const attendanceEndDate =
    payrollPeriods.at(-1)?.periodEnd ?? endOfMonth(startDate);
  const attendanceDates = getWorkingDatesBetween(startDate, attendanceEndDate);

  console.log("Seeding attendance...");

  for (
    let employeeStart = 0;
    employeeStart < employees.length;
    employeeStart += ATTENDANCE_EMPLOYEE_BATCH_SIZE
  ) {
    const employeeBatch = employees.slice(
      employeeStart,
      employeeStart + ATTENDANCE_EMPLOYEE_BATCH_SIZE,
    );
    const now = new Date();
    const attendanceRows = [];

    for (const [index, employee] of employeeBatch.entries()) {
      const employeeIndex = employeeStart + index + 1;

      for (const date of attendanceDates) {
        const status = getAttendanceStatus(employeeIndex, date);

        attendanceRows.push({
          employeeId: employee.id,
          date,
          status,
          checkInTime:
            status === AttendanceStatus.ABSENT
              ? null
              : new Date(`${formatDate(date)}T09:00:00.000Z`),
          checkOutTime:
            status === AttendanceStatus.ABSENT
              ? null
              : new Date(
                  `${formatDate(date)}T${
                    status === AttendanceStatus.HALF_DAY ? "13:00" : "18:00"
                  }:00.000Z`,
                ),
          otHours:
            status === AttendanceStatus.PRESENT &&
            (employeeIndex + date.getUTCDate()) % 11 === 0
              ? 2
              : 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await prisma.attendance.createMany({
      data: attendanceRows,
      skipDuplicates: true,
    });

    console.log(
      `Attendance inserted for employees: ${Math.min(
        employeeStart + ATTENDANCE_EMPLOYEE_BATCH_SIZE,
        employees.length,
      )}/${employees.length}`,
    );
  }

  console.log("Fetching salary history ids...");

  const salaryHistories = await prisma.salaryHistory.findMany({
    where: {
      employeeId: {
        in: employees.map((employee) => employee.id),
      },
      effectiveFrom: LOAD_EFFECTIVE_FROM,
    },
    select: {
      id: true,
      employeeId: true,
      salaryAmount: true,
    },
  });
  const salaryByEmployeeId = new Map(
    salaryHistories.map((salary) => [salary.employeeId, salary]),
  );

  console.log("Seeding payroll, payslips, and ledger entries...");

  for (
    let employeeStart = 0;
    employeeStart < employees.length;
    employeeStart += PAYROLL_EMPLOYEE_BATCH_SIZE
  ) {
    const employeeBatch = employees.slice(
      employeeStart,
      employeeStart + PAYROLL_EMPLOYEE_BATCH_SIZE,
    );
    const payrollRows = [];
    const now = new Date();

    for (const [index, employee] of employeeBatch.entries()) {
      const employeeIndex = employeeStart + index + 1;
      const salary = salaryByEmployeeId.get(employee.id);

      if (!salary) {
        throw new Error(`Missing salary history for ${employee.employeeCode}`);
      }

      for (const { periodStart, periodEnd } of payrollPeriods) {
        const snapshot = calculatePayrollSnapshot({
          employeeIndex,
          salaryHistoryId: salary.id,
          monthlySalary: Number(salary.salaryAmount),
          periodStart,
          periodEnd,
        });

        payrollRows.push({
          employeeId: employee.id,
          periodStart,
          periodEnd,
          salaryType: SalaryType.MONTHLY,
          activePayrollKey: buildActivePayrollKey({
            employeeId: employee.id,
            periodStart,
            periodEnd,
          }),
          grossSalary: snapshot.grossSalary,
          standardSalary: snapshot.standardSalary,
          otTotalHours: snapshot.otTotalHours,
          otHourlyRate: snapshot.otHourlyRate,
          otEarnings: snapshot.otEarnings,
          advanceDeduction: 0,
          carryForwardApplied: 0,
          totalDeduction: 0,
          rawFinalSalary: snapshot.finalSalary,
          carryForwardDeduction: 0,
          finalSalary: snapshot.finalSalary,
          totalDays: snapshot.workingDays,
          workingDays: snapshot.workingDays,
          presentDays: snapshot.presentDays,
          absentDays: snapshot.absentDays,
          halfDays: snapshot.halfDays,
          version: 1,
          status: PayrollStatus.GENERATED,
          lockedAt: now,
          salaryBreakdown: snapshot.salaryBreakdown,
          attendanceBreakdown: snapshot.attendanceBreakdown,
          advanceBreakdown: snapshot.advanceBreakdown,
          overtimeBreakdown: snapshot.overtimeBreakdown,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await prisma.payroll.createMany({
      data: payrollRows,
      skipDuplicates: true,
    });

    const createdPayrolls = await prisma.payroll.findMany({
      where: {
        employeeId: {
          in: employeeBatch.map((employee) => employee.id),
        },
        periodStart: {
          gte: payrollPeriods[0].periodStart,
        },
        periodEnd: {
          lte: payrollPeriods[payrollPeriods.length - 1].periodEnd,
        },
      },
      select: {
        id: true,
        employeeId: true,
        periodStart: true,
        periodEnd: true,
        standardSalary: true,
        otTotalHours: true,
        otHourlyRate: true,
        otEarnings: true,
        advanceDeduction: true,
        finalSalary: true,
        totalDays: true,
        presentDays: true,
        absentDays: true,
        halfDays: true,
        version: true,
        isRecalculated: true,
        salaryBreakdown: true,
        overtimeBreakdown: true,
      },
      orderBy: [{ employeeId: "asc" }, { periodStart: "asc" }],
    });

    const payslipRows = [];
    const ledgerRows = [];
    const balances = new Map<string, number>();

    for (const payroll of createdPayrolls) {
      payslipRows.push({
        employeeId: payroll.employeeId,
        payrollId: payroll.id,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        totalDays: payroll.totalDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        halfDays: payroll.halfDays,
        salaryBreakdown: toInputJson(payroll.salaryBreakdown),
        standardSalary: payroll.standardSalary,
        otTotalHours: payroll.otTotalHours,
        otHourlyRate: payroll.otHourlyRate,
        otEarnings: payroll.otEarnings,
        overtimeBreakdown: toInputJson(payroll.overtimeBreakdown),
        advanceDeduction: payroll.advanceDeduction,
        finalSalary: payroll.finalSalary,
        payrollVersion: payroll.version,
        isRecalculated: payroll.isRecalculated,
        status: PayslipStatus.READY,
        pdfGeneratedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      const currentBalance = balances.get(payroll.employeeId) ?? 0;
      const salaryBalance = roundMoney(
        currentBalance + Number(payroll.standardSalary),
      );

      ledgerRows.push({
        employeeId: payroll.employeeId,
        payrollId: payroll.id,
        type: LedgerType.SALARY,
        referenceId: payroll.id,
        debit: 0,
        credit: Number(payroll.standardSalary),
        balance: salaryBalance,
        date: payroll.periodEnd,
        createdAt: now,
      });

      let nextBalance = salaryBalance;

      if (Number(payroll.otEarnings) > 0) {
        nextBalance = roundMoney(nextBalance + Number(payroll.otEarnings));
        ledgerRows.push({
          employeeId: payroll.employeeId,
          payrollId: payroll.id,
          type: LedgerType.OVERTIME,
          referenceId: payroll.id,
          debit: 0,
          credit: Number(payroll.otEarnings),
          balance: nextBalance,
          date: payroll.periodEnd,
          createdAt: now,
        });
      }

      balances.set(payroll.employeeId, nextBalance);
    }

    await prisma.payslip.createMany({
      data: payslipRows,
      skipDuplicates: true,
    });

    await prisma.ledgerEntry.deleteMany({
      where: {
        payrollId: {
          in: createdPayrolls.map((payroll) => payroll.id),
        },
      },
    });

    await prisma.ledgerEntry.createMany({
      data: ledgerRows,
    });

    for (const payroll of createdPayrolls) {
      await prisma.attendance.updateMany({
        where: {
          employeeId: payroll.employeeId,
          date: {
            gte: payroll.periodStart,
            lte: payroll.periodEnd,
          },
        },
        data: {
          lockedByPayrollId: payroll.id,
        },
      });
    }

    await prisma.salaryHistory.updateMany({
      where: {
        employeeId: {
          in: employeeBatch.map((employee) => employee.id),
        },
        effectiveFrom: {
          lte: payrollPeriods[payrollPeriods.length - 1].periodEnd,
        },
        lockedFromPayrollId: null,
      },
      data: {
        lockedFromPayrollId: createdPayrolls.at(-1)?.id ?? null,
      },
    });

    console.log(
      `Payroll/payslip/ledger inserted for employees: ${Math.min(
        employeeStart + PAYROLL_EMPLOYEE_BATCH_SIZE,
        employees.length,
      )}/${employees.length}`,
    );
  }

  console.log("Load test seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
