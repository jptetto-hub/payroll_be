import {
  AdvanceDeductionMode,
  AttendanceStatus,
  SalaryType,
} from "@prisma/client";
import { SalaryCalculationRepository } from "./salary-calculation.repository";
import { PayrollCarryForwardRepository } from "../payroll-carry-forward/payroll-carry-forward.repository";
import { getWorkingDatesBetween } from "../../shared/payroll/payrollDate.utils";
import { getEffectivePayrollPeriod } from "../../shared/payroll/payrollPeriod.utils";
import { OvertimeService } from "../../services/overtime.service";
import { PerformanceTimer } from "../../utils/performanceTimer";

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

const isSunday = (date: Date) => date.getUTCDay() === 0;

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;
const roundFinalSalary = (amount: number) => Math.round(amount);

const toNumber = (value: unknown) => Number(value ?? 0);

const getWeeklyCarryInSunday = (params: {
  salaryType: SalaryType;
  periodStart: Date;
  joiningDate: Date;
}) => {
  if (
    params.salaryType !== SalaryType.WEEKLY ||
    params.periodStart.getUTCDay() !== 1
  ) {
    return null;
  }

  const precedingSunday = addDays(params.periodStart, -1);

  return precedingSunday >= params.joiningDate ? precedingSunday : null;
};

const allocateManualAdvanceDeduction = (
  advances: any[],
  requestedAmount: number,
) => {
  let remainingDeduction = roundMoney(requestedAmount);
  const allocatedAdvances = [];

  for (const advance of advances) {
    if (remainingDeduction <= 0) break;

    const remainingAmount = Number(advance.remainingAmount);
    const deductedAmount = roundMoney(
      Math.min(remainingAmount, remainingDeduction),
    );

    if (deductedAmount <= 0) continue;

    allocatedAdvances.push({
      ...advance,
      __deductedAmount: deductedAmount,
      deductedAmount,
    });
    remainingDeduction = roundMoney(remainingDeduction - deductedAmount);
  }

  return allocatedAdvances;
};

type SalaryPreviewEmployee = {
  id: string;
  employeeCode: string;
  name: string;
  status: string;
  salaryType: SalaryType;
  advanceDeductionMode?: AdvanceDeductionMode;
  joiningDate: Date;
};

type SalaryPreviewOptions = {
  employee?: SalaryPreviewEmployee;
  skipActivePayrollSnapshot?: boolean;
  manualDeductionAmountOverride?: number;
  recalculationPayrollSnapshot?: {
    advanceBreakdown?: unknown;
  };
};

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
      advanceDeductionMode:
        advanceBreakdown.advanceDeductionMode ?? AdvanceDeductionMode.AUTO,
      manualDeductionId: advanceBreakdown.manualDeductionId ?? null,
      manualDeductionAmount: toNumber(advanceBreakdown.manualDeductionAmount),
      manualOutstandingTotal: toNumber(advanceBreakdown.manualOutstandingTotal),
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
  }, options: SalaryPreviewOptions = {}) {
    const timer = new PerformanceTimer("SalaryCalculationService.preview");
    timer.checkpoint("start");

    const periodStart = parseDateOnly(data.periodStart);
    const periodEnd = parseDateOnly(data.periodEnd);
    const missingDates: string[] = [];

    if (periodStart > periodEnd) {
      throw new Error("periodStart cannot be greater than periodEnd");
    }

    const employee =
      options.employee ??
      (await SalaryCalculationRepository.findEmployee(data.employeeId));
    timer.checkpoint("employee fetch");

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
    const weeklyCarryInSunday = getWeeklyCarryInSunday({
      salaryType: employee.salaryType,
      periodStart,
      joiningDate: employee.joiningDate,
    });

    const activePayrollSnapshot =
      options.skipActivePayrollSnapshot || options.recalculationPayrollSnapshot
      ? null
      : await SalaryCalculationRepository.findActivePayrollSnapshot(
          data.employeeId,
          periodStart,
          periodEnd,
        );
    timer.checkpoint("active payroll snapshot fetch");

    if (activePayrollSnapshot) {
      const snapshotPreview = buildPreviewFromPayrollSnapshot(
        activePayrollSnapshot,
        employee,
        periodStart,
        periodEnd,
        effectivePeriodStart,
        effectivePeriodEnd,
        joinedDuringCycle,
      );
      timer.checkpoint("snapshot preview build");
      timer.end();

      return snapshotPreview;
    }

    const recalculationAdvanceBreakdown =
      (options.recalculationPayrollSnapshot?.advanceBreakdown as any) ?? null;
    const recalculationCarryForwardSummary =
      recalculationAdvanceBreakdown?.carryForwardApplied ?? null;
    const advanceDeductionMode =
      employee.advanceDeductionMode ?? AdvanceDeductionMode.AUTO;

    const [
      salaryHistories,
      attendanceRecords,
      workHourSettings,
      advances,
      pendingCarryForwards,
      unprocessedEarlierAdvances,
      manualDeduction,
    ] = await Promise.all([
      SalaryCalculationRepository.getSalaryHistories(
        data.employeeId,
        effectivePeriodEnd,
      ),
      SalaryCalculationRepository.getAttendance(
        data.employeeId,
        weeklyCarryInSunday ?? effectivePeriodStart,
        effectivePeriodEnd,
      ),
      OvertimeService.getSettingsForDateRange(
        weeklyCarryInSunday ?? effectivePeriodStart,
        effectivePeriodEnd,
      ),
      recalculationAdvanceBreakdown
        ? Promise.resolve(recalculationAdvanceBreakdown.advances ?? [])
        : advanceDeductionMode === AdvanceDeductionMode.MANUAL
          ? SalaryCalculationRepository.getOutstandingAdvances(
              data.employeeId,
              periodEnd,
            )
          : SalaryCalculationRepository.getAdvancesWithCancelledPayrollSnapshot(
              data.employeeId,
              periodStart,
              periodEnd,
            ),
      recalculationCarryForwardSummary
        ? Promise.resolve(
            recalculationCarryForwardSummary.pendingCarryForwards ?? [],
          )
        : advanceDeductionMode === AdvanceDeductionMode.MANUAL
          ? Promise.resolve([])
          : PayrollCarryForwardRepository.findPendingByEmployee(
              data.employeeId,
              periodStart,
            ),
      options.recalculationPayrollSnapshot ||
      advanceDeductionMode === AdvanceDeductionMode.MANUAL
        ? Promise.resolve([])
        : SalaryCalculationRepository.getUnprocessedEarlierAdvances(
            data.employeeId,
            periodStart,
          ),
      advanceDeductionMode === AdvanceDeductionMode.MANUAL
        ? options.manualDeductionAmountOverride !== undefined
          ? Promise.resolve({
              amount: options.manualDeductionAmountOverride,
            })
          : SalaryCalculationRepository.getManualDeduction(
              data.employeeId,
              periodStart,
              periodEnd,
            )
        : Promise.resolve(null),
    ]);
    timer.checkpoint("payroll inputs fetch");

    if (
      advanceDeductionMode === AdvanceDeductionMode.AUTO &&
      unprocessedEarlierAdvances.length > 0
    ) {
      const pendingCycles = [
        ...new Set(
          unprocessedEarlierAdvances.map(
            (advance) =>
              `${formatDate(advance.cycleStartDate)} to ${formatDate(advance.cycleEndDate)}`,
          ),
        ),
      ];

      throw new Error(
        `Earlier advance deduction cycle is not yet processed: ${pendingCycles.join(", ")}. Generate that payroll first so any unpaid balance is carried forward correctly.`,
      );
    }

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
    const cycleWorkingDays = Math.max(
      getWorkingDatesBetween(periodStart, periodEnd).length,
      1,
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
          const workDate = new Date(`${formattedDate}T00:00:00.000Z`);
          const workHourSetting = OvertimeService.resolveSettingFromList(
            workHourSettings,
            workDate,
          );
          const dailyHours = Math.max(
            Number(workHourSetting.standardMinutes) / 60,
            1,
          );
          const dailyRate =
            (Number(salary.salaryAmount) / cycleWorkingDays) / dailyHours;
          const dailyOtEarnings = roundMoney(dailyRate * dailyOtHours);

          otHours = roundMoney(otHours + dailyOtHours);
          otEarnings = roundMoney(otEarnings + dailyOtEarnings);
          otWeightedRateTotal += dailyRate * dailyOtHours;
        }
      }

      const workingDays = workingDates.length;

      // A Monday-Saturday weekly cycle pays the preceding Sunday OT in this
      // cycle because Sunday is a rest day outside normal weekly attendance.
      const overtimeSegmentStart =
        index === 0 && weeklyCarryInSunday
          ? weeklyCarryInSunday
          : segmentStart;
      const sundayOtRecords = attendanceRecords.filter(
        (attendance) =>
          isSunday(attendance.date) &&
          attendance.date >= overtimeSegmentStart &&
          attendance.date <= segmentEnd &&
          Number((attendance as any).otHours ?? 0) > 0,
      );

      for (const attendance of sundayOtRecords) {
        const dailyOtHours = Number((attendance as any).otHours ?? 0);
        const workHourSetting = OvertimeService.resolveSettingFromList(
          workHourSettings,
          attendance.date,
        );
        const dailyHours = Math.max(
          Number(workHourSetting.standardMinutes) / 60,
          1,
        );
        const dailyRate =
          (Number(salary.salaryAmount) / cycleWorkingDays) /
          dailyHours;
        const dailyOtEarnings = roundMoney(dailyRate * dailyOtHours);

        otHours = roundMoney(otHours + dailyOtHours);
        otEarnings = roundMoney(otEarnings + dailyOtEarnings);
        otWeightedRateTotal += dailyRate * dailyOtHours;
      }

      // Salary amount represents the full monthly/weekly cycle rate. When a
      // history changes mid-cycle, each segment earns only its share of that cycle.
      const perDaySalary = Number(salary.salaryAmount) / cycleWorkingDays;

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
    timer.checkpoint("calculation loop");

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
    const manualOutstandingTotal = roundMoney(
      advances.reduce(
        (sum: number, item: any) => sum + Number(item.remainingAmount),
        0,
      ),
    );
    const manualRequestedDeduction =
      advanceDeductionMode === AdvanceDeductionMode.MANUAL
        ? roundMoney(Number((manualDeduction as any)?.amount ?? 0))
        : 0;
    const calculationAdvances =
      advanceDeductionMode === AdvanceDeductionMode.MANUAL
        ? allocateManualAdvanceDeduction(
            advances,
            Math.min(manualRequestedDeduction, manualOutstandingTotal),
          )
        : advances;

    const invalidAdvances = calculationAdvances.filter(
      (item: any) => item.payCycleType !== employee.salaryType,
    );

    if (invalidAdvances.length > 0) {
      throw new Error(
        "Advance pay cycle type does not match employee salary type",
      );
    }

    const hasInvalidRemainingAmount = calculationAdvances.some(
      (item: any) => Number(item.remainingAmount) < 0,
    );

    if (hasInvalidRemainingAmount) {
      throw new Error("Invalid advance remaining amount found");
    }

    const advanceDeduction = roundMoney(
      calculationAdvances.reduce(
        (sum: number, item: any) =>
          sum +
          Number(
            advanceDeductionMode === AdvanceDeductionMode.MANUAL
              ? item.__deductedAmount
              : item.remainingAmount,
          ),
        0,
      ),
    );

    if (advanceDeduction < 0) {
      throw new Error("Invalid advance deduction amount");
    }

    if (missingDates.length > 0) {
      throw new Error(
        `Cannot generate payroll. Attendance missing for dates: ${missingDates.join(", ")}`,
      );
    }

    if (
      advanceDeductionMode === AdvanceDeductionMode.MANUAL &&
      advanceDeduction > grossSalary
    ) {
      throw new Error(
        `Manual advance deduction cannot exceed payable salary ${grossSalary}. You can deduct up to ${grossSalary} for this cycle.`,
      );
    }

    let remainingGrossForCarryForward = roundMoney(
      grossSalary - advanceDeduction,
    );
    let carryForwardApplied = 0;
    const appliedCarryForwards = [];
    const eligibleCarryForwards = pendingCarryForwards.map((item: any) => ({
      ...item,
      amount: Number(item.amount),
      remainingAmount: Number(item.remainingAmount),
      sourceCycleStartDate: formatDate(item.cycleStartDate),
      sourceCycleEndDate: formatDate(item.cycleEndDate),
      appliedToPeriodStart: formatDate(periodStart),
      appliedToPeriodEnd: formatDate(periodEnd),
    }));

    for (const item of eligibleCarryForwards) {
      if (remainingGrossForCarryForward <= 0) break;

      const applyAmount = roundMoney(
        Math.min(item.remainingAmount, remainingGrossForCarryForward),
      );

      if (applyAmount <= 0) continue;

      carryForwardApplied = roundMoney(carryForwardApplied + applyAmount);
      remainingGrossForCarryForward = roundMoney(
        remainingGrossForCarryForward - applyAmount,
      );

      appliedCarryForwards.push({
        id: item.id,
        sourcePayrollId: item.sourcePayrollId,
        amount: item.amount,
        remainingAmount: item.remainingAmount,
        appliedAmount: applyAmount,
        previousStatus: item.status,
        sourceCycleStartDate: item.sourceCycleStartDate,
        sourceCycleEndDate: item.sourceCycleEndDate,
        appliedToPeriodStart: item.appliedToPeriodStart,
        appliedToPeriodEnd: item.appliedToPeriodEnd,
      });
    }

    carryForwardApplied = roundMoney(carryForwardApplied);
    const totalDeduction = roundMoney(advanceDeduction + carryForwardApplied);
    const rawFinalSalary = roundMoney(grossSalary - totalDeduction);
    const finalSalary =
      rawFinalSalary < 0 ? 0 : roundFinalSalary(rawFinalSalary);
    const carryForwardDeduction =
      rawFinalSalary < 0 ? roundMoney(Math.abs(rawFinalSalary)) : 0;

    const result = {
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
        advances: calculationAdvances,
        advanceDeduction,
        advanceDeductionMode,
        manualDeductionId: (manualDeduction as any)?.id ?? null,
        manualDeductionAmount: manualRequestedDeduction,
        manualOutstandingTotal,
      },
      carryForwardSummary: {
        pendingCarryForwards: eligibleCarryForwards,
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
    timer.checkpoint("response build");
    timer.end();

    return result;
  }
}
