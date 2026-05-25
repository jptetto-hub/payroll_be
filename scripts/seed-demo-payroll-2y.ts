import {
  AdvanceSettlementStatus,
  AttendanceStatus,
  CarryForwardStatus,
  EmployeeStatus,
  LedgerType,
  PayrollStatus,
  PayslipStatus,
  Prisma,
  Role,
  SalaryType,
  SchedulerRunItemStatus,
  SchedulerRunStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";
import { buildActivePayrollKey } from "../src/utils/payrollKey";

const EMPLOYEE_COUNT = Number(process.env.SEED_DEMO_EMPLOYEE_COUNT || 50);
const PASSWORD = process.env.SEED_PASSWORD || "Password@123";
const SUPER_ADMIN_PHONE = process.env.SEED_SUPER_ADMIN_PHONE || "9999999999";
const SUPER_ADMIN_CODE = process.env.SEED_SUPER_ADMIN_CODE || "SUPERADMIN";
const EMPLOYEE_PREFIX = process.env.SEED_DEMO_EMPLOYEE_PREFIX || "DEMO";
const START_DATE = toUtcDate(
  new Date(process.env.SEED_DEMO_START_DATE || "2024-06-01T00:00:00.000Z"),
);
const MONTH_COUNT = Number(process.env.SEED_DEMO_MONTHS || 24);
const RESET_DEMO_DATA = process.env.SEED_DEMO_RESET !== "false";

type DemoEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  salaryType: SalaryType;
};

function pad(num: number, size = 6) {
  return String(num).padStart(size, "0");
}

function toUtcDate(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

function getWorkingDates(from: Date, to: Date) {
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

function getMonthlyPeriods() {
  return Array.from({ length: MONTH_COUNT }, (_, index) => {
    const periodStart = addMonths(START_DATE, index);
    return {
      periodStart,
      periodEnd: endOfMonth(periodStart),
    };
  });
}

function getWeeklyPeriods() {
  const periods: Array<{ periodStart: Date; periodEnd: Date }> = [];
  const finalMonthStart = addMonths(START_DATE, MONTH_COUNT - 1);
  const finalDate = endOfMonth(finalMonthStart);
  let cursor = new Date(START_DATE);

  while (cursor <= finalDate) {
    const periodStart = new Date(cursor);
    const periodEnd = new Date(
      Math.min(addDays(periodStart, 6).getTime(), finalDate.getTime()),
    );
    periods.push({ periodStart, periodEnd });
    cursor = addDays(periodStart, 7);
  }

  return periods;
}

function getAttendanceStatus(employeeIndex: number, date: Date) {
  if ((employeeIndex + date.getUTCDate() + date.getUTCMonth()) % 31 === 0) {
    return AttendanceStatus.ABSENT;
  }

  if ((employeeIndex + date.getUTCDate()) % 19 === 0) {
    return AttendanceStatus.HALF_DAY;
  }

  return AttendanceStatus.PRESENT;
}

function getAttendanceCredit(status: AttendanceStatus) {
  if (status === AttendanceStatus.PRESENT) return 1;
  if (status === AttendanceStatus.HALF_DAY) return 0.5;
  return 0;
}

function getOtHours(
  employeeIndex: number,
  date: Date,
  status: AttendanceStatus,
) {
  if (status !== AttendanceStatus.PRESENT) return 0;
  if ((employeeIndex + date.getUTCDate()) % 8 === 0) return 2;
  if ((employeeIndex + date.getUTCDate()) % 13 === 0) return 1;
  return 0;
}

function getSalaryAmount(employeeIndex: number, salaryType: SalaryType) {
  if (salaryType === SalaryType.MONTHLY) {
    return 28000 + employeeIndex * 175;
  }

  return 7000 + employeeIndex * 35;
}

function shouldHaveAdvance(employeeIndex: number, periodIndex: number) {
  return employeeIndex % 5 === 0 && periodIndex % 6 === 1;
}

function shouldHaveCarryForward(employeeIndex: number, periodIndex: number) {
  return employeeIndex % 10 === 0 && periodIndex % 8 === 3;
}

function calculatePayrollSnapshot(params: {
  employeeIndex: number;
  salaryHistoryId: string;
  salaryAmount: number;
  salaryType: SalaryType;
  periodStart: Date;
  periodEnd: Date;
  periodIndex: number;
}) {
  const workingDates = getWorkingDates(params.periodStart, params.periodEnd);
  let presentDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let attendedDays = 0;
  let otTotalHours = 0;

  for (const date of workingDates) {
    const status = getAttendanceStatus(params.employeeIndex, date);
    const otHours = getOtHours(params.employeeIndex, date, status);

    if (status === AttendanceStatus.PRESENT) presentDays += 1;
    if (status === AttendanceStatus.ABSENT) absentDays += 1;
    if (status === AttendanceStatus.HALF_DAY) halfDays += 1;

    attendedDays += getAttendanceCredit(status);
    otTotalHours += otHours;
  }

  const workingDays = Math.max(workingDates.length, 1);
  const perDaySalary = roundMoney(params.salaryAmount / workingDays);
  const standardSalary = roundMoney(perDaySalary * attendedDays);
  const otHourlyRate = roundMoney(perDaySalary / 8);
  const otEarnings = roundMoney(otTotalHours * otHourlyRate);
  const advanceDeduction = shouldHaveAdvance(
    params.employeeIndex,
    params.periodIndex,
  )
    ? roundMoney(Math.min(standardSalary * 0.18, 4500))
    : 0;
  const carryForwardApplied = shouldHaveCarryForward(
    params.employeeIndex,
    params.periodIndex,
  )
    ? roundMoney(Math.min(standardSalary * 0.08, 2500))
    : 0;
  const grossSalary = roundMoney(standardSalary + otEarnings);
  const totalDeduction = roundMoney(advanceDeduction + carryForwardApplied);
  const rawFinalSalary = roundMoney(grossSalary - advanceDeduction);
  const finalSalary = roundMoney(grossSalary - totalDeduction);

  const salaryBreakdown = [
    {
      salaryHistoryId: params.salaryHistoryId,
      salaryType: params.salaryType,
      salaryAmount: params.salaryAmount,
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
    advanceDeduction,
    carryForwardApplied,
    totalDeduction,
    rawFinalSalary,
    finalSalary,
    salaryBreakdown,
    attendanceBreakdown: {
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
    },
    advanceBreakdown: {
      advances:
        advanceDeduction > 0
          ? [
              {
                amount: advanceDeduction,
                date: formatDate(params.periodStart),
                status: "SETTLED_FROM_PAYROLL",
              },
            ]
          : [],
      advanceDeduction,
      carryForwardApplied: {
        pendingCarryForwards: [],
        appliedCarryForwards:
          carryForwardApplied > 0
            ? [
                {
                  amount: carryForwardApplied,
                  appliedOn: formatDate(params.periodEnd),
                },
              ]
            : [],
        carryForwardApplied,
      },
    },
    overtimeBreakdown: {
      otTotalHours,
      otHourlyRate,
      otEarnings,
      segments: [
        {
          salaryHistoryId: params.salaryHistoryId,
          segmentStart: formatDate(params.periodStart),
          segmentEnd: formatDate(params.periodEnd),
          otHours: otTotalHours,
          otHourlyRate,
          otEarnings,
        },
      ],
    },
  };
}

async function resetExistingDemoData() {
  const demoEmployees = await prisma.employee.findMany({
    where: {
      employeeCode: {
        startsWith: EMPLOYEE_PREFIX,
      },
    },
    select: {
      id: true,
    },
  });
  const employeeIds = demoEmployees.map((employee) => employee.id);

  if (employeeIds.length > 0) {
    await prisma.ledgerEntry.deleteMany({
      where: {
        employeeId: {
          in: employeeIds,
        },
      },
    });
    await prisma.employee.deleteMany({
      where: {
        id: {
          in: employeeIds,
        },
      },
    });
  }

  const demoRuns = await prisma.schedulerRun.findMany({
    where: {
      name: {
        in: ["DEMO_MONTHLY_PAYROLL_SCHEDULER", "DEMO_WEEKLY_PAYROLL_SCHEDULER"],
      },
    },
    select: {
      id: true,
    },
  });

  if (demoRuns.length > 0) {
    await prisma.schedulerRun.deleteMany({
      where: {
        id: {
          in: demoRuns.map((run) => run.id),
        },
      },
    });
  }
}

async function seedEmployees(passwordHash: string) {
  const now = new Date();

  await prisma.employee.upsert({
    where: { phone: SUPER_ADMIN_PHONE },
    update: {
      password: passwordHash,
      role: Role.SUPER_ADMIN,
      status: EmployeeStatus.ACTIVE,
    },
    create: {
      employeeCode: SUPER_ADMIN_CODE,
      name: "Demo Super Admin",
      phone: SUPER_ADMIN_PHONE,
      password: passwordHash,
      role: Role.SUPER_ADMIN,
      salaryType: SalaryType.MONTHLY,
      status: EmployeeStatus.ACTIVE,
      joiningDate: START_DATE,
    },
  });

  await prisma.employee.createMany({
    data: Array.from({ length: EMPLOYEE_COUNT }, (_, index) => {
      const employeeNumber = index + 1;
      const salaryType =
        employeeNumber % 2 === 0 ? SalaryType.MONTHLY : SalaryType.WEEKLY;

      return {
        employeeCode: `${EMPLOYEE_PREFIX}${pad(employeeNumber)}`,
        name: `Demo Employee ${employeeNumber}`,
        phone: `7${pad(employeeNumber, 9)}`,
        password: passwordHash,
        role: Role.USER,
        salaryType,
        status: EmployeeStatus.ACTIVE,
        joiningDate: START_DATE,
        designation: [
          "Machine Operator",
          "Assembly Technician",
          "Quality Inspector",
          "Store Assistant",
        ][employeeNumber % 4],
        department: ["Production", "Assembly", "Quality", "Stores"][
          employeeNumber % 4
        ],
        createdAt: now,
        updatedAt: now,
      };
    }),
    skipDuplicates: true,
  });

  return prisma.employee.findMany({
    where: {
      employeeCode: {
        startsWith: EMPLOYEE_PREFIX,
      },
    },
    select: {
      id: true,
      employeeCode: true,
      name: true,
      salaryType: true,
    },
    orderBy: {
      employeeCode: "asc",
    },
  });
}

async function seedSettings() {
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
    where: { effectiveFromDate: START_DATE },
    update: {
      workStartTime: "09:00",
      workEndTime: "18:00",
      standardMinutes: 480,
      isActive: true,
      note: "Demo 2-year seed work hours",
    },
    create: {
      workStartTime: "09:00",
      workEndTime: "18:00",
      standardMinutes: 480,
      effectiveFromDate: START_DATE,
      isActive: true,
      note: "Demo 2-year seed work hours",
    },
  });
}

async function seedSalaryHistory(employees: DemoEmployee[]) {
  const now = new Date();

  await prisma.salaryHistory.createMany({
    data: employees.map((employee, index) => ({
      employeeId: employee.id,
      salaryAmount: getSalaryAmount(index + 1, employee.salaryType),
      effectiveFrom: START_DATE,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });
}

async function seedAttendance(employees: DemoEmployee[]) {
  const monthlyPeriods = getMonthlyPeriods();
  const attendanceEnd = monthlyPeriods[monthlyPeriods.length - 1].periodEnd;
  const dates = getWorkingDates(START_DATE, attendanceEnd);
  const employeeBatchSize = 25;

  for (
    let employeeStart = 0;
    employeeStart < employees.length;
    employeeStart += employeeBatchSize
  ) {
    const employeeBatch = employees.slice(
      employeeStart,
      employeeStart + employeeBatchSize,
    );
    const now = new Date();
    const rows = [];

    for (const [index, employee] of employeeBatch.entries()) {
      const employeeIndex = employeeStart + index + 1;

      for (const date of dates) {
        const status = getAttendanceStatus(employeeIndex, date);
        const otHours = getOtHours(employeeIndex, date, status);
        const dateText = formatDate(date);

        rows.push({
          employeeId: employee.id,
          date,
          status,
          checkInTime:
            status === AttendanceStatus.ABSENT
              ? null
              : new Date(`${dateText}T09:00:00.000Z`),
          checkOutTime:
            status === AttendanceStatus.ABSENT
              ? null
              : new Date(
                  `${dateText}T${status === AttendanceStatus.HALF_DAY ? "13:00" : "18:00"}:00.000Z`,
                ),
          otStartTime:
            otHours > 0 ? new Date(`${dateText}T18:15:00.000Z`) : null,
          otEndTime:
            otHours > 0
              ? new Date(
                  `${dateText}T${20 + Math.max(otHours - 2, 0)}:15:00.000Z`,
                )
              : null,
          otHours,
          otBreakdown:
            otHours > 0
              ? toInputJson({
                  source: "demo-seed",
                  minutes: otHours * 60,
                  reason: "Production overtime",
                })
              : Prisma.JsonNull,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await prisma.attendance.createMany({
      data: rows,
      skipDuplicates: true,
    });

    console.log(
      `Attendance seeded: ${Math.min(employeeStart + employeeBatchSize, employees.length)}/${employees.length} employees`,
    );
  }
}

async function seedPayrollData(employees: DemoEmployee[]) {
  const monthlyPeriods = getMonthlyPeriods();
  const weeklyPeriods = getWeeklyPeriods();
  const salaries = await prisma.salaryHistory.findMany({
    where: {
      employeeId: {
        in: employees.map((employee) => employee.id),
      },
      effectiveFrom: START_DATE,
    },
    select: {
      id: true,
      employeeId: true,
      salaryAmount: true,
    },
  });
  const salaryByEmployeeId = new Map(
    salaries.map((salary) => [salary.employeeId, salary]),
  );
  const balances = new Map<string, number>();
  const employeeBatchSize = 10;

  for (
    let employeeStart = 0;
    employeeStart < employees.length;
    employeeStart += employeeBatchSize
  ) {
    const employeeBatch = employees.slice(
      employeeStart,
      employeeStart + employeeBatchSize,
    );
    const payrollRows = [];
    const advanceRows = [];
    const now = new Date();

    for (const [index, employee] of employeeBatch.entries()) {
      const employeeIndex = employeeStart + index + 1;
      const salary = salaryByEmployeeId.get(employee.id);
      const periods =
        employee.salaryType === SalaryType.MONTHLY
          ? monthlyPeriods
          : weeklyPeriods;

      if (!salary) {
        throw new Error(`Missing salary history for ${employee.employeeCode}`);
      }

      for (const [periodIndex, period] of periods.entries()) {
        const snapshot = calculatePayrollSnapshot({
          employeeIndex,
          salaryHistoryId: salary.id,
          salaryAmount: Number(salary.salaryAmount),
          salaryType: employee.salaryType,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          periodIndex,
        });

        if (snapshot.advanceDeduction > 0) {
          advanceRows.push({
            employeeId: employee.id,
            amount: snapshot.advanceDeduction,
            date: period.periodStart,
            payCycleType: employee.salaryType,
            cycleStartDate: period.periodStart,
            cycleEndDate: period.periodEnd,
            remainingAmount: 0,
            isSettled: true,
            settledAmount: snapshot.advanceDeduction,
            carryForwardAmount: 0,
            settlementStatus: AdvanceSettlementStatus.SETTLED,
            note: "Demo settled advance deducted from payroll",
            createdAt: now,
            updatedAt: now,
          });
        }

        payrollRows.push({
          employeeId: employee.id,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          salaryType: employee.salaryType,
          activePayrollKey: buildActivePayrollKey({
            employeeId: employee.id,
            periodStart: period.periodStart,
            periodEnd: period.periodEnd,
          }),
          grossSalary: snapshot.grossSalary,
          standardSalary: snapshot.standardSalary,
          otTotalHours: snapshot.otTotalHours,
          otHourlyRate: snapshot.otHourlyRate,
          otEarnings: snapshot.otEarnings,
          advanceDeduction: snapshot.advanceDeduction,
          carryForwardApplied: snapshot.carryForwardApplied,
          totalDeduction: snapshot.totalDeduction,
          rawFinalSalary: snapshot.rawFinalSalary,
          carryForwardDeduction: snapshot.carryForwardApplied,
          finalSalary: snapshot.finalSalary,
          totalDays: snapshot.workingDays,
          workingDays: snapshot.workingDays,
          presentDays: snapshot.presentDays,
          absentDays: snapshot.absentDays,
          halfDays: snapshot.halfDays,
          version: 1,
          status:
            periodIndex % 5 === 0
              ? PayrollStatus.PAID
              : PayrollStatus.GENERATED,
          lockedAt: now,
          salaryBreakdown: toInputJson(snapshot.salaryBreakdown),
          attendanceBreakdown: toInputJson(snapshot.attendanceBreakdown),
          advanceBreakdown: toInputJson(snapshot.advanceBreakdown),
          overtimeBreakdown: toInputJson(snapshot.overtimeBreakdown),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await prisma.advancePayment.createMany({
      data: advanceRows,
    });

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
          gte: START_DATE,
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
        carryForwardApplied: true,
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
    const carryForwardRows = [];

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

      let balance = balances.get(payroll.employeeId) ?? 0;
      balance = roundMoney(balance + Number(payroll.standardSalary));
      ledgerRows.push({
        employeeId: payroll.employeeId,
        payrollId: payroll.id,
        type: LedgerType.SALARY,
        referenceId: payroll.id,
        debit: 0,
        credit: Number(payroll.standardSalary),
        balance,
        date: payroll.periodEnd,
        createdAt: now,
      });

      if (Number(payroll.otEarnings) > 0) {
        balance = roundMoney(balance + Number(payroll.otEarnings));
        ledgerRows.push({
          employeeId: payroll.employeeId,
          payrollId: payroll.id,
          type: LedgerType.OVERTIME,
          referenceId: payroll.id,
          debit: 0,
          credit: Number(payroll.otEarnings),
          balance,
          date: payroll.periodEnd,
          createdAt: now,
        });
      }

      if (Number(payroll.advanceDeduction) > 0) {
        balance = roundMoney(balance - Number(payroll.advanceDeduction));
        ledgerRows.push({
          employeeId: payroll.employeeId,
          payrollId: payroll.id,
          type: LedgerType.ADVANCE,
          referenceId: payroll.id,
          debit: Number(payroll.advanceDeduction),
          credit: 0,
          balance,
          date: payroll.periodEnd,
          createdAt: now,
        });
      }

      if (Number(payroll.carryForwardApplied) > 0) {
        balance = roundMoney(balance - Number(payroll.carryForwardApplied));
        ledgerRows.push({
          employeeId: payroll.employeeId,
          payrollId: payroll.id,
          type: LedgerType.DEDUCTION,
          referenceId: payroll.id,
          debit: Number(payroll.carryForwardApplied),
          credit: 0,
          balance,
          date: payroll.periodEnd,
          createdAt: now,
        });

        carryForwardRows.push({
          employeeId: payroll.employeeId,
          sourcePayrollId: payroll.id,
          amount: Number(payroll.carryForwardApplied),
          remainingAmount: 0,
          cycleStartDate: payroll.periodStart,
          cycleEndDate: payroll.periodEnd,
          status: CarryForwardStatus.DEDUCTED,
          createdAt: now,
          updatedAt: now,
        });
      }

      balances.set(payroll.employeeId, balance);
    }

    await prisma.payslip.createMany({
      data: payslipRows,
      skipDuplicates: true,
    });
    await prisma.ledgerEntry.createMany({
      data: ledgerRows,
    });
    await prisma.payrollCarryForward.createMany({
      data: carryForwardRows,
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

    console.log(
      `Payroll seeded: ${Math.min(employeeStart + employeeBatchSize, employees.length)}/${employees.length} employees`,
    );
  }
}

async function seedSchedulerRuns(employees: DemoEmployee[]) {
  const monthlyEmployees = employees.filter(
    (employee) => employee.salaryType === SalaryType.MONTHLY,
  );
  const weeklyEmployees = employees.filter(
    (employee) => employee.salaryType === SalaryType.WEEKLY,
  );
  const monthlyPeriods = getMonthlyPeriods();
  const weeklyPeriods = getWeeklyPeriods().filter(
    (_, index) => index % 4 === 0,
  );
  const runRows = [];

  for (const [index, period] of monthlyPeriods.entries()) {
    runRows.push({
      name: "DEMO_MONTHLY_PAYROLL_SCHEDULER",
      status:
        index === monthlyPeriods.length - 1
          ? SchedulerRunStatus.PARTIAL_SUCCESS
          : SchedulerRunStatus.COMPLETED,
      totalEmployees: monthlyEmployees.length,
      processedEmployees: monthlyEmployees.length,
      successCount: Math.max(
        monthlyEmployees.length - (index % 6 === 0 ? 2 : 0),
        0,
      ),
      skippedCount: index % 5 === 0 ? 1 : 0,
      failedCount: index % 6 === 0 ? 1 : 0,
      startedAt: new Date(`${formatDate(period.periodEnd)}T01:00:00.000Z`),
      completedAt: new Date(`${formatDate(period.periodEnd)}T01:08:00.000Z`),
      metadata: toInputJson({
        salaryType: SalaryType.MONTHLY,
        periodStart: formatDate(period.periodStart),
        periodEnd: formatDate(period.periodEnd),
        source: "demo-seed",
      }),
    });
  }

  for (const [index, period] of weeklyPeriods.entries()) {
    runRows.push({
      name: "DEMO_WEEKLY_PAYROLL_SCHEDULER",
      status: SchedulerRunStatus.COMPLETED,
      totalEmployees: weeklyEmployees.length,
      processedEmployees: weeklyEmployees.length,
      successCount: weeklyEmployees.length,
      skippedCount: index % 4 === 0 ? 1 : 0,
      failedCount: 0,
      startedAt: new Date(`${formatDate(period.periodEnd)}T01:30:00.000Z`),
      completedAt: new Date(`${formatDate(period.periodEnd)}T01:35:00.000Z`),
      metadata: toInputJson({
        salaryType: SalaryType.WEEKLY,
        periodStart: formatDate(period.periodStart),
        periodEnd: formatDate(period.periodEnd),
        source: "demo-seed",
      }),
    });
  }

  await prisma.schedulerRun.createMany({
    data: runRows,
  });

  const runs = await prisma.schedulerRun.findMany({
    where: {
      name: {
        in: ["DEMO_MONTHLY_PAYROLL_SCHEDULER", "DEMO_WEEKLY_PAYROLL_SCHEDULER"],
      },
      metadata: {
        path: ["source"],
        equals: "demo-seed",
      },
    },
    select: {
      id: true,
      name: true,
      metadata: true,
    },
    orderBy: {
      startedAt: "asc",
    },
  });
  const payrolls = await prisma.payroll.findMany({
    where: {
      employeeId: {
        in: employees.map((employee) => employee.id),
      },
    },
    select: {
      id: true,
      employeeId: true,
      periodStart: true,
      periodEnd: true,
    },
  });
  const payrollByEmployeePeriod = new Map(
    payrolls.map((payroll) => [
      `${payroll.employeeId}_${formatDate(payroll.periodStart)}_${formatDate(payroll.periodEnd)}`,
      payroll.id,
    ]),
  );
  const items = [];

  for (const run of runs) {
    const metadata = run.metadata as {
      salaryType?: SalaryType;
      periodStart?: string;
      periodEnd?: string;
    };
    const runEmployees =
      metadata.salaryType === SalaryType.MONTHLY
        ? monthlyEmployees
        : weeklyEmployees;

    for (const [index, employee] of runEmployees.entries()) {
      const status =
        index === 0 && run.name === "DEMO_MONTHLY_PAYROLL_SCHEDULER"
          ? SchedulerRunItemStatus.SKIPPED
          : index === 1 && run.name === "DEMO_MONTHLY_PAYROLL_SCHEDULER"
            ? SchedulerRunItemStatus.FAILED
            : SchedulerRunItemStatus.SUCCESS;
      const payrollId =
        metadata.periodStart && metadata.periodEnd
          ? payrollByEmployeePeriod.get(
              `${employee.id}_${metadata.periodStart}_${metadata.periodEnd}`,
            )
          : undefined;

      items.push({
        runId: run.id,
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        periodStart: metadata.periodStart
          ? new Date(`${metadata.periodStart}T00:00:00.000Z`)
          : null,
        periodEnd: metadata.periodEnd
          ? new Date(`${metadata.periodEnd}T00:00:00.000Z`)
          : null,
        status,
        reason:
          status === SchedulerRunItemStatus.SKIPPED
            ? "Demo skipped: payroll already existed"
            : null,
        errorMessage:
          status === SchedulerRunItemStatus.FAILED
            ? "Demo failed: missing approval checkpoint"
            : null,
        payrollId: status === SchedulerRunItemStatus.SUCCESS ? payrollId : null,
      });
    }
  }

  await prisma.schedulerRunItem.createMany({
    data: items,
  });
}

async function main() {
  console.log(
    `Seeding ${EMPLOYEE_COUNT} demo employees with mixed weekly/monthly payroll for ${MONTH_COUNT} months...`,
  );

  if (RESET_DEMO_DATA) {
    console.log("Resetting existing demo seed data...");
    await resetExistingDemoData();
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  await seedSettings();
  const employees = await seedEmployees(passwordHash);
  await seedSalaryHistory(employees);
  await seedAttendance(employees);
  await seedPayrollData(employees);
  await seedSchedulerRuns(employees);

  console.log("Demo 2-year payroll seed completed.");
  console.log({
    employees: employees.length,
    monthlyEmployees: employees.filter(
      (employee) => employee.salaryType === SalaryType.MONTHLY,
    ).length,
    weeklyEmployees: employees.filter(
      (employee) => employee.salaryType === SalaryType.WEEKLY,
    ).length,
    months: MONTH_COUNT,
    loginPhone: SUPER_ADMIN_PHONE,
    loginPassword: PASSWORD,
  });
}

main()
  .catch((error) => {
    console.error("Demo seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
