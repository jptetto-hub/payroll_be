import { AttendanceStatus, SalaryType } from "@prisma/client";
import { SalaryCalculationRepository } from "./salary-calculation.repository";
import { PayrollCarryForwardRepository } from "../payroll-carry-forward/payroll-carry-forward.repository";
import { getWorkingDatesBetween } from "../../shared/payroll/payrollDate.utils";
import { getEffectivePayrollPeriod } from "../../shared/payroll/payrollPeriod.utils";
import { OvertimeService } from "../../services/overtime.service";

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const ensureDateOnOrAfterJoining = (params: {
  date: Date;
  joiningDate: Date;
  action: string;
}) => {
  if (formatDate(params.date) < formatDate(params.joiningDate)) {
    throw new Error(
      `${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`,
    );
  }
};

const addDays = (date: Date | string, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const getAttendanceValue = (status?: AttendanceStatus) => {
  if (status === AttendanceStatus.PRESENT) return 1;
  if (status === AttendanceStatus.HALF_DAY) return 0.5;
  return 0;
};

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

const toNumber = (value: unknown) => Number(value ?? 0);

const buildPreviewFromPayrollSnapshot = (
  payroll: any,
  employee: {
    id: string;
    employeeCode: string;
    name: string;
    salaryType: SalaryType;
    joiningDate: Date;
  },
  periodStart: Date,
  periodEnd: Date,
  effectivePeriodStart: Date,
  effectivePeriodEnd: Date,
  joinedDuringCycle: boolean,
) => {
  const attendanceBreakdown = (payroll.attendanceBreakdown as any) ?? {};
  const advanceBreakdown = (payroll.advanceBreakdown as any) ?? {};
  const overtimeBreakdown = (payroll.overtimeBreakdown as any) ?? {};
  const salaryBreakdown = ((payroll.salaryBreakdown as any[]) ?? []).map(
    (item) => ({
      ...item,
      salaryAmount: toNumber(item.salaryAmount),
      workingDays: toNumber(item.workingDays),
      presentDays: toNumber(item.presentDays),
      halfDays: toNumber(item.halfDays),
      absentDays: toNumber(item.absentDays),
      missingDays: toNumber(item.missingDays),
      attendedDays: toNumber(item.attendedDays),
      perDaySalary: toNumber(item.perDaySalary),
      standardSalary: toNumber(item.standardSalary),
      otHours: toNumber(item.otHours),
      otHourlyRate: toNumber(item.otHourlyRate),
      otEarnings: toNumber(item.otEarnings),
      grossSalary: toNumber(item.grossSalary),
    }),
  );

  const otTotalHours = toNumber(payroll.otTotalHours);
  const otHourlyRate = toNumber(payroll.otHourlyRate);
  const otEarnings = toNumber(payroll.otEarnings);
  const advanceDeduction = toNumber(payroll.advanceDeduction);
  const carryForwardApplied = toNumber(payroll.carryForwardApplied);
  const totalDeduction = toNumber(payroll.totalDeduction);
  const rawFinalSalary = toNumber(payroll.rawFinalSalary);
  const finalSalary = toNumber(payroll.finalSalary);
  const carryForwardDeduction = toNumber(payroll.carryForwardDeduction);

  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      salaryType: employee.salaryType,
    },
    period: {
      periodStart: formatDate(periodStart),
      periodEnd: formatDate(periodEnd),
      effectivePeriodStart: formatDate(effectivePeriodStart),
      effectivePeriodEnd: formatDate(effectivePeriodEnd),
      joinedDuringCycle,
    },
    attendanceSummary: {
      workingDays: toNumber(attendanceBreakdown.workingDays ?? payroll.workingDays),
      presentDays: toNumber(attendanceBreakdown.presentDays ?? payroll.presentDays),
      halfDays: toNumber(attendanceBreakdown.halfDays ?? payroll.halfDays),
      absentDays: toNumber(attendanceBreakdown.absentDays ?? payroll.absentDays),
      missingDays: toNumber(attendanceBreakdown.missingDays),
      attendedDays: toNumber(
        attendanceBreakdown.attendedDays ??
          toNumber(payroll.presentDays) + toNumber(payroll.halfDays) * 0.5,
      ),
      otTotalHours,
      otEarnings,
      effectivePeriodStart: attendanceBreakdown.effectivePeriodStart ??
        formatDate(effectivePeriodStart),
      effectivePeriodEnd: attendanceBreakdown.effectivePeriodEnd ??
        formatDate(effectivePeriodEnd),
      joinedDuringCycle,
    },
    salaryBreakdown,
    advanceSummary: {
      advances: advanceBreakdown.advances ?? [],
      advanceDeduction,
    },
    carryForwardSummary: {
      pendingCarryForwards: [],
      appliedCarryForwards:
        advanceBreakdown.carryForwardApplied?.appliedCarryForwards ?? [],
      carryForwardApplied,
    },
    overtimeSummary: {
      otTotalHours,
      otHourlyRate,
      otEarnings,
      segments: overtimeBreakdown.segments ?? salaryBreakdown.map((item) => ({
        salaryHistoryId: item.salaryHistoryId,
        segmentStart: item.segmentStart,
        segmentEnd: item.segmentEnd,
        otHours: toNumber(item.otHours),
        otHourlyRate: toNumber(item.otHourlyRate),
        otEarnings: toNumber(item.otEarnings),
      })),
    },
    result: {
      standardSalary: toNumber(payroll.standardSalary),
      grossSalary: toNumber(payroll.grossSalary),
      otTotalHours,
      otHourlyRate,
      otEarnings,
      advanceDeduction,
      carryForwardApplied,
      totalDeduction,
      rawFinalSalary,
      finalSalary,
      carryForwardDeduction,
      hasCarryForward: carryForwardDeduction > 0,
      isNegativeSalary: rawFinalSalary < 0,
    },
  };
};

export class SalaryCalculationService {
  static async preview(data: {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const periodStart = parseDateOnly(data.periodStart);
    const periodEnd = parseDateOnly(data.periodEnd);
    const missingDates: string[] = [];

    if (periodStart > periodEnd) {
      throw new Error("periodStart cannot be greater than periodEnd");
    }

    const employee = await SalaryCalculationRepository.findEmployee(
      data.employeeId,
    );

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status !== "ACTIVE") {
      throw new Error("Cannot calculate salary for inactive employee");
    }

    if (employee.joiningDate > periodEnd) {
      throw new Error("Employee joining date is after selected salary period");
    }

    ensureDateOnOrAfterJoining({
      date: periodStart,
      joiningDate: employee.joiningDate,
      action: "Salary calculation period start",
    });

    const {
      effectivePeriodStart,
      effectivePeriodEnd,
      joinedDuringCycle,
    } = getEffectivePayrollPeriod({
      periodStart,
      periodEnd,
      joiningDate: employee.joiningDate,
    });

    const activePayrollSnapshot =
      await SalaryCalculationRepository.findActivePayrollSnapshot(
        data.employeeId,
        periodStart,
        periodEnd,
      );

    if (activePayrollSnapshot) {
      return buildPreviewFromPayrollSnapshot(
        activePayrollSnapshot,
        employee,
        periodStart,
        periodEnd,
        effectivePeriodStart,
        effectivePeriodEnd,
        joinedDuringCycle,
      );
    }

    const salaryHistories =
      await SalaryCalculationRepository.getSalaryHistories(
        data.employeeId,
        effectivePeriodEnd,
      );

    if (salaryHistories.length === 0) {
      throw new Error("No salary history found for this employee");
    }

    const salaryBeforePeriod = salaryHistories
      .filter((item) => item.effectiveFrom <= effectivePeriodStart)
      .at(-1);

    if (!salaryBeforePeriod) {
      throw new Error("No salary history found before selected period start");
    }

    const salaryChangesInsidePeriod = salaryHistories.filter(
      (item) =>
        item.effectiveFrom > effectivePeriodStart &&
        item.effectiveFrom <= effectivePeriodEnd,
    );

    const salaryTimeline = [salaryBeforePeriod, ...salaryChangesInsidePeriod];

    const attendanceRecords = await SalaryCalculationRepository.getAttendance(
      data.employeeId,
      effectivePeriodStart,
      effectivePeriodEnd,
    );

    const attendanceMap = new Map(
      attendanceRecords.map((item) => [formatDate(item.date), item]),
    );

    const segments = [];

    for (let index = 0; index < salaryTimeline.length; index += 1) {
      const salary = salaryTimeline[index];

      if (!salary) continue;

      const segmentStart =
        salary.effectiveFrom > effectivePeriodStart
          ? salary.effectiveFrom
          : effectivePeriodStart;

      const nextSalary = salaryTimeline[index + 1];

      const segmentEnd = nextSalary
        ? addDays(nextSalary.effectiveFrom, -1)
        : effectivePeriodEnd;

      const workingDates = getWorkingDatesBetween(segmentStart, segmentEnd);

      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let missingDays = 0;
      let attendedDays = 0;
      let otHours = 0;
      let otEarnings = 0;
      let otWeightedRateTotal = 0;

      for (const formattedDate of workingDates) {
        const attendance = attendanceMap.get(formattedDate);
        const status = attendance?.status;

        if (status === AttendanceStatus.PRESENT) presentDays += 1;
        else if (status === AttendanceStatus.HALF_DAY) halfDays += 1;
        else if (status === AttendanceStatus.ABSENT) absentDays += 1;
        else {
          missingDays += 1;
          missingDates.push(formattedDate);
        }

        attendedDays += getAttendanceValue(status);

        const dailyOtHours = Number((attendance as any)?.otHours ?? 0);

        if (dailyOtHours > 0) {
          const workHourSetting = await OvertimeService.getSettingForDate(
            new Date(`${formattedDate}T00:00:00.000Z`),
          );
          const dailyHours = Math.max(workHourSetting.standardMinutes / 60, 1);
          const dailyRate =
            (Number(salary.salaryAmount) / workingDates.length) / dailyHours;
          const dailyOtEarnings = roundMoney(dailyRate * dailyOtHours);

          otHours = roundMoney(otHours + dailyOtHours);
          otEarnings = roundMoney(otEarnings + dailyOtEarnings);
          otWeightedRateTotal += dailyRate * dailyOtHours;
        }
      }

      const workingDays = workingDates.length;

      const perDaySalary =
        employee.salaryType === SalaryType.MONTHLY
          ? Number(salary.salaryAmount) / workingDays
          : Number(salary.salaryAmount) / workingDays;

      const segmentGrossSalary = roundMoney(perDaySalary * attendedDays);

      const otHourlyRate =
        otHours > 0 ? roundMoney(otWeightedRateTotal / otHours) : 0;

      segments.push({
        salaryHistoryId: salary.id,
        salaryAmount: Number(salary.salaryAmount),
        segmentStart: formatDate(segmentStart),
        segmentEnd: formatDate(segmentEnd),
        workingDays,
        presentDays,
        halfDays,
        absentDays,
        missingDays,
        attendedDays,
        perDaySalary: roundMoney(perDaySalary),
        standardSalary: segmentGrossSalary,
        otHours,
        otHourlyRate,
        otEarnings,
        grossSalary: roundMoney(segmentGrossSalary + otEarnings),
      });
    }

    const totalWorkingDays = segments.reduce(
      (sum, item) => sum + item.workingDays,
      0,
    );

    const presentDays = segments.reduce(
      (sum, item) => sum + item.presentDays,
      0,
    );
    const halfDays = segments.reduce((sum, item) => sum + item.halfDays, 0);
    const absentDays = segments.reduce((sum, item) => sum + item.absentDays, 0);
    const missingDays = segments.reduce(
      (sum, item) => sum + item.missingDays,
      0,
    );
    const attendedDays = segments.reduce(
      (sum, item) => sum + item.attendedDays,
      0,
    );

    const standardSalary = roundMoney(
      segments.reduce((sum, item) => sum + item.standardSalary, 0),
    );
    const otTotalHours = roundMoney(
      segments.reduce((sum, item) => sum + item.otHours, 0),
    );
    const otEarnings = roundMoney(
      segments.reduce((sum, item) => sum + item.otEarnings, 0),
    );
    const otHourlyRate =
      otTotalHours > 0 ? roundMoney(otEarnings / otTotalHours) : 0;
    const grossSalary = roundMoney(
      standardSalary + otEarnings,
    );

    const advances =
      await SalaryCalculationRepository.getAdvancesWithCancelledPayrollSnapshot(
        data.employeeId,
        periodStart,
        periodEnd,
      );

    const invalidAdvances = advances.filter(
      (item) => item.payCycleType !== employee.salaryType,
    );

    if (invalidAdvances.length > 0) {
      throw new Error(
        "Advance pay cycle type does not match employee salary type",
      );
    }

    const hasInvalidRemainingAmount = advances.some(
      (item) => Number(item.remainingAmount) < 0,
    );

    if (hasInvalidRemainingAmount) {
      throw new Error("Invalid advance remaining amount found");
    }

    const advanceDeduction = roundMoney(
      advances.reduce((sum, item) => sum + Number(item.remainingAmount), 0),
    );

    if (advanceDeduction < 0) {
      throw new Error("Invalid advance deduction amount");
    }

    if (missingDates.length > 0) {
      throw new Error(
        `Cannot generate payroll. Attendance missing for dates: ${missingDates.join(", ")}`,
      );
    }

    const pendingCarryForwards =
      await PayrollCarryForwardRepository.findPendingByEmployee(
        data.employeeId,
        periodStart,
      );

    let remainingGrossForCarryForward = roundMoney(
      grossSalary - advanceDeduction,
    );
    let carryForwardApplied = 0;
    const appliedCarryForwards = [];

    for (const item of pendingCarryForwards) {
      if (remainingGrossForCarryForward <= 0) break;

      const applyAmount = roundMoney(
        Math.min(Number(item.remainingAmount), remainingGrossForCarryForward),
      );

      carryForwardApplied = roundMoney(carryForwardApplied + applyAmount);
      remainingGrossForCarryForward = roundMoney(
        remainingGrossForCarryForward - applyAmount,
      );

      appliedCarryForwards.push({
        id: item.id,
        amount: Number(item.amount),
        remainingAmount: Number(item.remainingAmount),
        appliedAmount: applyAmount,
        previousStatus: item.status,
      });
    }

    carryForwardApplied = roundMoney(carryForwardApplied);
    const totalDeduction = roundMoney(advanceDeduction + carryForwardApplied);
    const rawFinalSalary = roundMoney(grossSalary - totalDeduction);
    const finalSalary = rawFinalSalary < 0 ? 0 : rawFinalSalary;
    const carryForwardDeduction =
      rawFinalSalary < 0 ? roundMoney(Math.abs(rawFinalSalary)) : 0;

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        salaryType: employee.salaryType,
      },
      period: {
        periodStart: formatDate(periodStart),
        periodEnd: formatDate(periodEnd),
        effectivePeriodStart: formatDate(effectivePeriodStart),
        effectivePeriodEnd: formatDate(effectivePeriodEnd),
        joinedDuringCycle,
      },
      attendanceSummary: {
        workingDays: totalWorkingDays,
        presentDays,
        halfDays,
        absentDays,
        missingDays,
        attendedDays,
        otTotalHours,
        otEarnings,
        effectivePeriodStart: formatDate(effectivePeriodStart),
        effectivePeriodEnd: formatDate(effectivePeriodEnd),
        joinedDuringCycle,
      },
      salaryBreakdown: segments,
      advanceSummary: {
        advances,
        advanceDeduction,
      },
      carryForwardSummary: {
        pendingCarryForwards,
        appliedCarryForwards,
        carryForwardApplied,
      },
      overtimeSummary: {
        otTotalHours,
        otHourlyRate,
        otEarnings,
        segments: segments.map((item) => ({
          salaryHistoryId: item.salaryHistoryId,
          segmentStart: item.segmentStart,
          segmentEnd: item.segmentEnd,
          otHours: item.otHours,
          otHourlyRate: item.otHourlyRate,
          otEarnings: item.otEarnings,
        })),
      },
      result: {
        standardSalary,
        grossSalary,
        otTotalHours,
        otHourlyRate,
        otEarnings,
        advanceDeduction,
        carryForwardApplied,
        totalDeduction,
        rawFinalSalary,
        finalSalary,
        carryForwardDeduction,
        hasCarryForward: carryForwardDeduction > 0,
        isNegativeSalary: rawFinalSalary < 0,
      },
    };
  }
}
