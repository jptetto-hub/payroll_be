import { AttendanceStatus, SalaryType } from "@prisma/client";
import { SalaryCalculationRepository } from "./salary-calculation.repository";
import { PayrollCarryForwardRepository } from "../payroll-carry-forward/payroll-carry-forward.repository";
import { getWorkingDatesBetween } from "../../shared/payroll/payrollDate.utils";
import { getEffectivePayrollPeriod } from "../../shared/payroll/payrollPeriod.utils";

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
      attendanceRecords.map((item) => [formatDate(item.date), item.status]),
    );

    const segments = salaryTimeline.map((salary, index) => {
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

      for (const formattedDate of workingDates) {
        const status = attendanceMap.get(formattedDate);

        if (status === AttendanceStatus.PRESENT) presentDays += 1;
        else if (status === AttendanceStatus.HALF_DAY) halfDays += 1;
        else if (status === AttendanceStatus.ABSENT) absentDays += 1;
        else {
          missingDays += 1;
          missingDates.push(formattedDate);
        }

        attendedDays += getAttendanceValue(status);
      }

      const workingDays = workingDates.length;

      const perDaySalary =
        employee.salaryType === SalaryType.MONTHLY
          ? Number(salary.salaryAmount) / workingDays
          : Number(salary.salaryAmount) / workingDays;

      const segmentGrossSalary = roundMoney(perDaySalary * attendedDays);

      return {
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
        grossSalary: segmentGrossSalary,
      };
    });

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

    const grossSalary = roundMoney(
      segments.reduce((sum, item) => sum + item.grossSalary, 0),
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
      result: {
        grossSalary,
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
