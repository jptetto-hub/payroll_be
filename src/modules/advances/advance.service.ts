import {
  AdvanceDeductionMode,
  Prisma,
  Role,
  SalaryType,
  WeekStartsOn,
} from "@prisma/client";
import { AdvanceRepository } from "./advance.repository";
import { LedgerService } from "../ledger/ledger.service";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { assertAdvanceCycleNotLocked } from "../../shared/payroll/payroll-lock.util";
import { CacheService } from "../../utils/cache";
import { getBusinessDate } from "../../shared/time/business-date.util";
import { SalaryCalculationService } from "../salary-calculation/salary-calculation.service";

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const parseOptionalDateOnly = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return parseDateOnly(value);
};

const parseDateRange = (query: any) => {
  const from = parseOptionalDateOnly(query.from);
  const to = parseOptionalDateOnly(query.to);

  if (from && to && from > to) {
    throw new Error("From date cannot be greater than To date");
  }

  return { from, to };
};

const parseOptionalBooleanQuery = (value: unknown) => {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value === "true" || value === true;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const roundMoney = (amount: number) => Math.round(amount * 100) / 100;
const toMoneyNumber = (value: unknown) => roundMoney(Number(value ?? 0));
const toOptionalMoneyNumber = (value: unknown) =>
  value === null || value === undefined ? null : toMoneyNumber(value);
const ADVANCE_READ_CACHE_PREFIX = "advance-read";
const ADVANCE_READ_CACHE_TTL = 30;

const applyUnlockedManualDeductions = <T extends {
  remainingAmount: unknown;
  settledAmount?: unknown;
  isSettled?: boolean;
}>(
  advances: T[],
  manualDeductions: Array<{ amount: unknown }>,
) => {
  const adjustedAdvances = advances.map((advance) => ({
    ...advance,
    remainingAmount: toMoneyNumber(advance.remainingAmount),
    settledAmount: toMoneyNumber(advance.settledAmount),
  }));

  for (const manualDeduction of manualDeductions) {
    let remainingDeduction = toMoneyNumber(manualDeduction.amount);

    for (const advance of adjustedAdvances) {
      if (remainingDeduction <= 0) break;

      const available = toMoneyNumber(advance.remainingAmount);
      const appliedAmount = roundMoney(Math.min(available, remainingDeduction));

      if (appliedAmount <= 0) continue;

      advance.remainingAmount = roundMoney(available - appliedAmount);
      advance.settledAmount = roundMoney(
        toMoneyNumber(advance.settledAmount) + appliedAmount,
      );
      advance.isSettled = advance.remainingAmount <= 0;
      remainingDeduction = roundMoney(remainingDeduction - appliedAmount);
    }
  }

  return adjustedAdvances;
};

const invalidateAdvanceReadCaches = () => {
  void Promise.all([
    CacheService.delByPattern("dashboard:*"),
    CacheService.delByPattern("dashboard-summary:*"),
    CacheService.delByPattern("advance-summary:*"),
    CacheService.delByPattern(`${ADVANCE_READ_CACHE_PREFIX}:*`),
    CacheService.delByPattern("ledger-read:*"),
  ]);
};

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

const ensureNotFutureDate = (date: Date) => {
  if (date > getBusinessDate()) {
    throw new Error("Future advance date is not allowed");
  }
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const addMonths = (date: Date, months: number) => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
};

const getMonthStart = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const getMonthEnd = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};

const getWeekStart = (date: Date, weekStartsOn: WeekStartsOn) => {
  const day = date.getUTCDay();
  const startDay = weekStartsOn === "MONDAY" ? 1 : 0;
  const diff = (day - startDay + 7) % 7;

  return addDays(date, -diff);
};

const getWeeklyCycleEndSaturday = (cycleStartDate: Date) => {
  const day = cycleStartDate.getUTCDay();

  const saturday = 6;
  const diff = (saturday - day + 7) % 7;

  return addDays(cycleStartDate, diff);
};

const isSameDate = (a: Date, b: Date) => formatDate(a) === formatDate(b);

const ensureAccessToEmployee = (
  targetEmployeeRole: Role,
  currentUserRole: Role,
) => {
  if (currentUserRole === Role.ADMIN && targetEmployeeRole !== Role.USER) {
    throw new Error("ADMIN can manage advances only for USER employees");
  }
};

const ensureSalaryAvailableForAdvanceCycle = async (params: {
  employeeId: string;
  cycleStartDate: Date;
}) => {
  const salary = await AdvanceRepository.getSalaryForDate(
    params.employeeId,
    params.cycleStartDate,
  );

  if (!salary) {
    throw new Error(
      "Cannot process advance because salary history is not available for selected deduction cycle",
    );
  }
};

const getManualDeductionSalaryCapacity = async (params: {
  employee: NonNullable<Awaited<ReturnType<typeof AdvanceRepository.findEmployee>>>;
  periodStart: Date;
  periodEnd: Date;
  manualDeductionAmountOverride?: number;
  skipActivePayrollSnapshot?: boolean;
}) => {
  const preview = await SalaryCalculationService.preview(
    {
      employeeId: params.employee.id,
      periodStart: formatDate(params.periodStart),
      periodEnd: formatDate(params.periodEnd),
    },
    {
      employee: params.employee,
      skipActivePayrollSnapshot: params.skipActivePayrollSnapshot ?? true,
      manualDeductionAmountOverride:
        params.manualDeductionAmountOverride ?? 0,
    },
  );

  return roundMoney(Number(preview.result.grossSalary ?? 0));
};

const calculateCycle = (params: {
  salaryType: SalaryType;
  advanceDate: Date;
  deductionCycleStartDate: Date;
  weekStartsOn: WeekStartsOn;
}) => {
  const { salaryType, advanceDate, deductionCycleStartDate, weekStartsOn } =
    params;

  if (salaryType === SalaryType.WEEKLY) {
    const currentWeekStart = getWeekStart(advanceDate, weekStartsOn);
    const expectedWeekStart = getWeekStart(
      deductionCycleStartDate,
      weekStartsOn,
    );

    if (!isSameDate(deductionCycleStartDate, expectedWeekStart)) {
      throw new Error(
        `Weekly deduction cycle must start on configured week start day: ${weekStartsOn}`,
      );
    }

    const maxAllowedStart = addDays(currentWeekStart, 14);

    if (deductionCycleStartDate < currentWeekStart) {
      throw new Error("Deduction cycle cannot be before advance date cycle");
    }

    if (deductionCycleStartDate > maxAllowedStart) {
      throw new Error(
        "Weekly advance deduction cannot go beyond 3 weekly cycles",
      );
    }

    return {
      cycleStartDate: deductionCycleStartDate,
      cycleEndDate: getWeeklyCycleEndSaturday(deductionCycleStartDate),
    };
  }

  const currentMonthStart = getMonthStart(advanceDate);
  const selectedMonthStart = getMonthStart(deductionCycleStartDate);

  if (!isSameDate(deductionCycleStartDate, selectedMonthStart)) {
    throw new Error("Monthly deduction cycle must start on 1st day of month");
  }

  const maxAllowedStart = addMonths(currentMonthStart, 2);

  if (deductionCycleStartDate < currentMonthStart) {
    throw new Error("Deduction cycle cannot be before advance date month");
  }

  if (deductionCycleStartDate > maxAllowedStart) {
    throw new Error(
      "Monthly advance deduction cannot go beyond 3 monthly cycles",
    );
  }

  return {
    cycleStartDate: deductionCycleStartDate,
    cycleEndDate: getMonthEnd(deductionCycleStartDate),
  };
};

const calculateAdvanceDateCycle = (params: {
  salaryType: SalaryType;
  advanceDate: Date;
  weekStartsOn: WeekStartsOn;
}) => {
  if (params.salaryType === SalaryType.WEEKLY) {
    const cycleStartDate = getWeekStart(params.advanceDate, params.weekStartsOn);

    return {
      cycleStartDate,
      cycleEndDate: getWeeklyCycleEndSaturday(cycleStartDate),
    };
  }

  return {
    cycleStartDate: getMonthStart(params.advanceDate),
    cycleEndDate: getMonthEnd(params.advanceDate),
  };
};

const validatePayrollPeriodLikeEmployeeCycle = async (params: {
  employeeSalaryType: SalaryType;
  periodStart: Date;
  periodEnd: Date;
}) => {
  const setting = await AdvanceRepository.getSystemSetting();
  const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

  if (params.employeeSalaryType === SalaryType.MONTHLY) {
    if (!isSameDate(params.periodStart, getMonthStart(params.periodStart))) {
      throw new Error("Monthly manual deduction period must start on 1st day of month");
    }

    if (!isSameDate(params.periodEnd, getMonthEnd(params.periodStart))) {
      throw new Error("Monthly manual deduction period must end on last day of month");
    }

    return;
  }

  const expectedStart = getWeekStart(params.periodStart, weekStartsOn);

  if (!isSameDate(params.periodStart, expectedStart)) {
    throw new Error(
      `Weekly manual deduction period must start on configured week start day: ${weekStartsOn}`,
    );
  }

  if (!isSameDate(params.periodEnd, getWeeklyCycleEndSaturday(params.periodStart))) {
    throw new Error("Weekly manual deduction period must end on Saturday");
  }
};

export class AdvanceService {
  static async deductionPreview(
    data: {
      employeeId: string;
      amount: number;
      date: string;
      deductionCycleStartDate: string;
      excludeAdvanceId?: string;
    },
    currentUserRole: Role,
  ) {
    const employee = await AdvanceRepository.findEmployee(data.employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    if (employee.advanceDeductionMode === AdvanceDeductionMode.MANUAL) {
      throw new Error(
        "This employee uses manual advance deduction. Enter the cycle deduction amount from the advance module instead of using auto deduction preview.",
      );
    }

    const advanceDate = parseDateOnly(data.date);
    const deductionCycleStartDate = parseDateOnly(data.deductionCycleStartDate);

    ensureNotFutureDate(advanceDate);
    ensureDateOnOrAfterJoining({
      date: advanceDate,
      joiningDate: employee.joiningDate,
      action: "Advance date",
    });

    const setting = await AdvanceRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;
    const cycle = calculateCycle({
      salaryType: employee.salaryType,
      advanceDate,
      deductionCycleStartDate,
      weekStartsOn,
    });

    ensureDateOnOrAfterJoining({
      date: cycle.cycleStartDate,
      joiningDate: employee.joiningDate,
      action: "Advance deduction cycle start",
    });

    await assertAdvanceCycleNotLocked({
      employeeId: employee.id,
      cycleStartDate: cycle.cycleStartDate,
      cycleEndDate: cycle.cycleEndDate,
    });

    const [
      salary,
      existingAdvances,
      pendingCarryForwards,
      unprocessedEarlierAdvances,
    ] = await Promise.all([
      AdvanceRepository.getSalaryForDate(employee.id, cycle.cycleStartDate),
      AdvanceRepository.getAdvancesForCycle(
        employee.id,
        cycle.cycleStartDate,
        cycle.cycleEndDate,
        data.excludeAdvanceId,
      ),
      AdvanceRepository.getPendingCarryForwardsBeforeCycle(
        employee.id,
        cycle.cycleStartDate,
      ),
      AdvanceRepository.getUnprocessedEarlierAdvances(
        employee.id,
        cycle.cycleStartDate,
      ),
    ]);

    if (!salary) {
      throw new Error(
        "Cannot preview advance because salary history is not available for selected deduction cycle",
      );
    }

    const referenceSalary = roundMoney(Number(salary.salaryAmount));
    const existingAdvanceTotal = roundMoney(
      existingAdvances.reduce(
        (total, advance) => total + Number(advance.remainingAmount),
        0,
      ),
    );
    const requestedAdvance = roundMoney(data.amount);
    const selectedCycleAdvanceTotal = roundMoney(
      existingAdvanceTotal + requestedAdvance,
    );
    let availableAfterCycleAdvances = Math.max(
      roundMoney(referenceSalary - selectedCycleAdvanceTotal),
      0,
    );
    const projectedCarryForwardApplications: {
      id: string;
      sourcePayrollId: string;
      sourceCycleStartDate: string;
      sourceCycleEndDate: string;
      remainingAmount: number;
      appliedAmount: number;
      remainingAfterApplication: number;
    }[] = [];

    for (const item of pendingCarryForwards) {
      const remainingAmount = roundMoney(Number(item.remainingAmount));
      const appliedAmount = roundMoney(
        Math.min(remainingAmount, availableAfterCycleAdvances),
      );

      projectedCarryForwardApplications.push({
        id: item.id,
        sourcePayrollId: item.sourcePayrollId,
        sourceCycleStartDate: formatDate(item.cycleStartDate),
        sourceCycleEndDate: formatDate(item.cycleEndDate),
        remainingAmount,
        appliedAmount,
        remainingAfterApplication: roundMoney(remainingAmount - appliedAmount),
      });

      availableAfterCycleAdvances = roundMoney(
        availableAfterCycleAdvances - appliedAmount,
      );
    }

    const earlierBalanceAvailable = roundMoney(
      pendingCarryForwards.reduce(
        (total, item) => total + Number(item.remainingAmount),
        0,
      ),
    );
    const earlierBalanceApplied = roundMoney(
      projectedCarryForwardApplications.reduce(
        (total, item) => total + item.appliedAmount,
        0,
      ),
    );
    const earlierBalanceRemaining = roundMoney(
      earlierBalanceAvailable - earlierBalanceApplied,
    );
    const selectedCycleOverflow = Math.max(
      roundMoney(selectedCycleAdvanceTotal - referenceSalary),
      0,
    );
    const projectedTotalDeduction = roundMoney(
      selectedCycleAdvanceTotal + earlierBalanceApplied,
    );
    const projectedPayableSalary = Math.max(
      roundMoney(referenceSalary - projectedTotalDeduction),
      0,
    );
    const projectedBalanceCarriedOnward = roundMoney(
      selectedCycleOverflow + earlierBalanceRemaining,
    );
    const today = getBusinessDate();
    const attendanceState =
      cycle.cycleStartDate > today
        ? "FUTURE_CYCLE"
        : cycle.cycleEndDate >= today
          ? "CURRENT_CYCLE"
          : "PAST_CYCLE";
    const unprocessedEarlierCycles = [
      ...new Map(
        unprocessedEarlierAdvances.map((advance) => {
          const cycleKey = `${formatDate(advance.cycleStartDate)}_${formatDate(
            advance.cycleEndDate,
          )}`;

          return [
            cycleKey,
            {
              startDate: formatDate(advance.cycleStartDate),
              endDate: formatDate(advance.cycleEndDate),
            },
          ];
        }),
      ).values(),
    ];

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        salaryType: employee.salaryType,
      },
      cycle: {
        startDate: formatDate(cycle.cycleStartDate),
        endDate: formatDate(cycle.cycleEndDate),
        attendanceState,
      },
      referenceSalary,
      existingAdvances: existingAdvances.map((advance) => ({
        id: advance.id,
        date: formatDate(advance.date),
        remainingAmount: Number(advance.remainingAmount),
      })),
      existingAdvanceTotal,
      requestedAdvance,
      selectedCycleAdvanceTotal,
      pendingCarryForwards: projectedCarryForwardApplications,
      earlierBalanceAvailable,
      earlierBalanceApplied,
      earlierBalanceRemaining,
      projectedTotalDeduction,
      projectedPayableSalary,
      selectedCycleOverflow,
      projectedBalanceCarriedOnward,
      unprocessedEarlierCycles,
      requiresEarlierPayrollProcessing: unprocessedEarlierCycles.length > 0,
      isProjection: true,
    };
  }

  static async createAdvance(
    data: {
      employeeId: string;
      amount: number;
      date: string;
      deductionCycleStartDate?: string;
      note?: string;
    },
    currentUserRole: Role,
  ) {
    const employee = await AdvanceRepository.findEmployee(data.employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status !== "ACTIVE") {
      throw new Error("Cannot create advance for inactive employee");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    const advanceDate = parseDateOnly(data.date);

    ensureNotFutureDate(advanceDate);
    ensureDateOnOrAfterJoining({
      date: advanceDate,
      joiningDate: employee.joiningDate,
      action: "Advance date",
    });

    const setting = await AdvanceRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

    let cycle;

    if (employee.advanceDeductionMode === AdvanceDeductionMode.MANUAL) {
      cycle = calculateAdvanceDateCycle({
        salaryType: employee.salaryType,
        advanceDate,
        weekStartsOn,
      });

      await ensureSalaryAvailableForAdvanceCycle({
        employeeId: employee.id,
        cycleStartDate: cycle.cycleStartDate,
      });
    } else {
      if (!data.deductionCycleStartDate) {
        throw new Error("Deduction cycle is required for auto deduction mode");
      }

      const deductionCycleStartDate = parseDateOnly(
        data.deductionCycleStartDate,
      );

      cycle = calculateCycle({
        salaryType: employee.salaryType,
        advanceDate,
        deductionCycleStartDate,
        weekStartsOn,
      });
      ensureDateOnOrAfterJoining({
        date: cycle.cycleStartDate,
        joiningDate: employee.joiningDate,
        action: "Advance deduction cycle start",
      });

      await assertAdvanceCycleNotLocked({
        employeeId: employee.id,
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
      });

      await ensureSalaryAvailableForAdvanceCycle({
        employeeId: employee.id,
        cycleStartDate: cycle.cycleStartDate,
      });
    }
    const advance = await AdvanceRepository.create({
      employeeId: employee.id,
      amount: data.amount,
      date: advanceDate,
      payCycleType: employee.salaryType,
      cycleStartDate: cycle.cycleStartDate,
      cycleEndDate: cycle.cycleEndDate,
      remainingAmount: data.amount,
      isSettled: false,
      ...(data.note !== undefined && { note: data.note }),
    });
    const ledgerEntry = await LedgerService.createAdvanceLedger({
      employeeId: employee.id,
      advanceId: advance.id,
      amount: data.amount,
      date: advanceDate,
    });

    invalidateAdvanceReadCaches();

    return {
      advance,
      ledgerEntry,
    };
  }

  static async listAdvances(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const { directEmployeeId, employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const isSettled = parseOptionalBooleanQuery(query.isSettled);
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "list",
      authUser.role,
      authUser.id,
      query.employeeId ?? "all",
      isSettled === undefined ? "all" : String(isSettled),
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const listParams: {
      skip: number;
      take: number;
      employeeId?: string;
      employeeWhere?: Prisma.EmployeeWhereInput;
      isSettled?: boolean;
      from?: Date;
      to?: Date;
    } = {
      skip,
      take,
      ...(directEmployeeId && { employeeId: directEmployeeId }),
      employeeWhere,
      ...dateRange,
    };

    if (isSettled !== undefined) {
      listParams.isSettled = isSettled;
    }

    const [advances, total] = await AdvanceRepository.listAll(listParams);

    const result = {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);

    return result;
  }

  static async myAdvances(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const isSettled = parseOptionalBooleanQuery(query.isSettled);
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "my",
      employeeId,
      isSettled === undefined ? "all" : String(isSettled),
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(
        employeeId,
        { skip, take },
        { ...dateRange, isSettled },
      ),
      AdvanceRepository.countByEmployee(employeeId, {
        ...dateRange,
        isSettled,
      }),
    ]);

    const result = {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);

    return result;
  }

  static async getAdvanceById(
    id: string,
    currentUser: { id: string; role: Role },
  ) {
    const advance = await AdvanceRepository.findById(id);

    if (!advance) {
      throw new Error("Advance not found");
    }

    if (
      currentUser.role === Role.USER &&
      advance.employeeId !== currentUser.id
    ) {
      throw new Error("You can view only your own advance");
    }

    ensureAccessToEmployee(advance.employee.role, currentUser.role);

    return advance;
  }

  static async listByEmployee(
    employeeId: string,
    currentUserRole: Role,
    query: any,
  ) {
    const employee = await AdvanceRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const isSettled = parseOptionalBooleanQuery(query.isSettled);
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "employee",
      employeeId,
      isSettled === undefined ? "all" : String(isSettled),
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(
        employeeId,
        { skip, take },
        { ...dateRange, isSettled },
      ),
      AdvanceRepository.countByEmployee(employeeId, {
        ...dateRange,
        isSettled,
      }),
    ]);

    const result = {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);

    return result;
  }

  static async listByCycle(
    employeeId: string,
    cycleStartDateValue: string,
    cycleEndDateValue: string,
    currentUserRole: Role,
  ) {
    const employee = await AdvanceRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    const cycleStartDate = parseDateOnly(cycleStartDateValue);
    const cycleEndDate = parseDateOnly(cycleEndDateValue);

    if (cycleStartDate > cycleEndDate) {
      throw new Error("cycleStartDate cannot be greater than cycleEndDate");
    }

    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "cycle",
      employeeId,
      cycleStartDateValue,
      cycleEndDateValue,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const advances = await AdvanceRepository.listByCycle(
      employeeId,
      cycleStartDate,
      cycleEndDate,
    );

    void CacheService.set(cacheKey, advances, ADVANCE_READ_CACHE_TTL);

    return advances;
  }

  static async getManualDeduction(
    employeeId: string,
    periodStartValue: string,
    periodEndValue: string,
    currentUserRole: Role,
  ) {
    const employee = await AdvanceRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    const periodStart = parseDateOnly(periodStartValue);
    const periodEnd = parseDateOnly(periodEndValue);

    if (periodStart > periodEnd) {
      throw new Error("periodStart cannot be greater than periodEnd");
    }

    const [
      manualDeduction,
      outstandingAdvances,
      advanceHistory,
      unlockedPriorManualDeductions,
    ] = await Promise.all([
      AdvanceRepository.getManualDeduction(employee.id, periodStart, periodEnd),
      AdvanceRepository.getOutstandingAdvances(employee.id, periodEnd),
      AdvanceRepository.getAdvanceHistoryUntil(employee.id, periodEnd),
      AdvanceRepository.getUnlockedManualDeductionsBefore(
        employee.id,
        periodStart,
      ),
    ]);
    const effectiveOutstandingAdvances = applyUnlockedManualDeductions(
      outstandingAdvances,
      unlockedPriorManualDeductions,
    ).filter((advance) => Number(advance.remainingAmount) > 0);
    const effectiveAdvanceHistory = applyUnlockedManualDeductions(
      advanceHistory,
      unlockedPriorManualDeductions,
    );
    const payrollSnapshot = manualDeduction?.lockedByPayrollId
      ? await AdvanceRepository.getPayrollSnapshot(manualDeduction.lockedByPayrollId)
      : null;
    const snapshotAdvanceBreakdown =
      (payrollSnapshot?.advanceBreakdown as any) ?? null;
    const snapshotOutstandingTotal = toOptionalMoneyNumber(
      snapshotAdvanceBreakdown?.manualOutstandingTotal,
    );
    const snapshotDeductionAmount = payrollSnapshot
      ? toOptionalMoneyNumber(
          snapshotAdvanceBreakdown?.advanceDeduction ??
            payrollSnapshot.advanceDeduction ??
            manualDeduction?.amount,
        )
      : null;
    const snapshotSalaryPayableAmount = payrollSnapshot
      ? toMoneyNumber(payrollSnapshot.grossSalary)
      : null;
    const snapshotBalanceAfterDeduction =
      snapshotOutstandingTotal !== null && snapshotDeductionAmount !== null
        ? Math.max(
            roundMoney(snapshotOutstandingTotal - snapshotDeductionAmount),
            0,
          )
        : null;
    const outstandingTotal = roundMoney(
      effectiveOutstandingAdvances.reduce(
        (sum, advance) => sum + Number(advance.remainingAmount),
        0,
      ),
    );
    const totalAdvanceReceived = roundMoney(
      effectiveAdvanceHistory.reduce(
        (sum, advance) => sum + Number(advance.amount),
        0,
      ),
    );
    const totalAdvanceDeducted = roundMoney(
      effectiveAdvanceHistory.reduce(
        (sum, advance) => sum + Number(advance.settledAmount ?? 0),
        0,
      ),
    );
    const currentCycleAdvances = effectiveAdvanceHistory.filter(
      (advance) =>
        advance.date >= periodStart &&
        advance.date <= periodEnd,
    );
    const cycleAdvanceReceived = roundMoney(
      currentCycleAdvances.reduce(
        (sum, advance) => sum + Number(advance.amount),
        0,
      ),
    );
    const cycleAdvanceDeducted = roundMoney(
      currentCycleAdvances.reduce(
        (sum, advance) => sum + Number(advance.settledAmount ?? 0),
        0,
      ),
    );
    const cycleDeductionAmount = roundMoney(Number(manualDeduction?.amount ?? 0));
    let salaryPayableAmount: number | null = null;
    let salaryCapacityError: string | null = null;

    if (snapshotSalaryPayableAmount !== null) {
      salaryPayableAmount = snapshotSalaryPayableAmount;
    } else {
      try {
        salaryPayableAmount = await getManualDeductionSalaryCapacity({
          employee,
          periodStart,
          periodEnd,
          skipActivePayrollSnapshot: !manualDeduction?.lockedByPayrollId,
        });
      } catch (error) {
        salaryCapacityError =
          error instanceof Error
            ? error.message
            : "Unable to calculate salary capacity";
      }
    }

    const effectiveOutstandingTotal =
      snapshotOutstandingTotal ?? outstandingTotal;
    const effectiveDeductionAmount =
      snapshotDeductionAmount ?? cycleDeductionAmount;
    const balanceAfterSavedDeduction =
      snapshotBalanceAfterDeduction ??
      (manualDeduction
        ? Math.max(
            roundMoney(effectiveOutstandingTotal - Number(manualDeduction.amount)),
            0,
          )
        : effectiveOutstandingTotal);
    const maxDeductibleAmount =
      salaryPayableAmount === null
        ? effectiveOutstandingTotal
        : Math.min(effectiveOutstandingTotal, salaryPayableAmount);

    return {
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        salaryType: employee.salaryType,
        advanceDeductionMode: employee.advanceDeductionMode,
      },
      period: {
        periodStart: formatDate(periodStart),
        periodEnd: formatDate(periodEnd),
      },
      manualDeduction,
      outstandingTotal: effectiveOutstandingTotal,
      salaryPayableAmount,
      salaryCapacityError,
      maxDeductibleAmount,
      cycleAdvanceReceived,
      cycleAdvanceDeducted,
      cycleDeductionAmount: effectiveDeductionAmount,
      totalAdvanceReceived,
      totalAdvanceDeducted,
      balanceAfterSavedDeduction,
      outstandingAdvances: effectiveAdvanceHistory,
      currentCycleAdvances,
    };
  }

  static async upsertManualDeduction(
    data: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
      amount: number;
      note?: string;
    },
    currentUserRole: Role,
    currentUserId?: string,
  ) {
    const employee = await AdvanceRepository.findEmployee(data.employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureAccessToEmployee(employee.role, currentUserRole);

    if (employee.advanceDeductionMode !== AdvanceDeductionMode.MANUAL) {
      throw new Error("Manual advance deduction is allowed only for employees in manual deduction mode");
    }

    const periodStart = parseDateOnly(data.periodStart);
    const periodEnd = parseDateOnly(data.periodEnd);

    if (periodStart > periodEnd) {
      throw new Error("periodStart cannot be greater than periodEnd");
    }

    await validatePayrollPeriodLikeEmployeeCycle({
      employeeSalaryType: employee.salaryType,
      periodStart,
      periodEnd,
    });
    ensureDateOnOrAfterJoining({
      date: periodStart,
      joiningDate: employee.joiningDate,
      action: "Manual advance deduction period start",
    });

    await ensureSalaryAvailableForAdvanceCycle({
      employeeId: employee.id,
      cycleStartDate: periodStart,
    });

    const existing = await AdvanceRepository.getManualDeduction(
      employee.id,
      periodStart,
      periodEnd,
    );

    if (existing?.lockedByPayrollId) {
      throw new Error("Manual deduction is already locked by generated payroll");
    }

    const [outstandingAdvances, unlockedPriorManualDeductions] =
      await Promise.all([
        AdvanceRepository.getOutstandingAdvances(employee.id, periodEnd),
        AdvanceRepository.getUnlockedManualDeductionsBefore(
          employee.id,
          periodStart,
        ),
      ]);
    const effectiveOutstandingAdvances = applyUnlockedManualDeductions(
      outstandingAdvances,
      unlockedPriorManualDeductions,
    ).filter((advance) => Number(advance.remainingAmount) > 0);
    const outstandingTotal = roundMoney(
      effectiveOutstandingAdvances.reduce(
        (sum, advance) => sum + Number(advance.remainingAmount),
        0,
      ),
    );

    if (data.amount > outstandingTotal) {
      throw new Error(
        `Manual deduction cannot exceed pending advance balance ${outstandingTotal}`,
      );
    }

    const salaryPayableAmount = await getManualDeductionSalaryCapacity({
      employee,
      periodStart,
      periodEnd,
      manualDeductionAmountOverride: data.amount,
    });

    if (data.amount > salaryPayableAmount) {
      throw new Error(
        `Manual advance deduction cannot exceed payable salary ${salaryPayableAmount}. You can deduct up to ${salaryPayableAmount} for this cycle.`,
      );
    }

    const manualDeduction = await AdvanceRepository.upsertManualDeduction({
      employeeId: employee.id,
      periodStart,
      periodEnd,
      salaryType: employee.salaryType,
      amount: data.amount,
      ...(data.note !== undefined && { note: data.note }),
      ...(currentUserId && { createdById: currentUserId }),
    });

    invalidateAdvanceReadCaches();

    return {
      manualDeduction,
      outstandingTotal,
      salaryPayableAmount,
      maxDeductibleAmount: Math.min(outstandingTotal, salaryPayableAmount),
      balanceAfterSavedDeduction: roundMoney(outstandingTotal - data.amount),
    };
  }

  static async deleteManualDeduction(
    id: string,
    currentUserRole: Role,
  ) {
    const manualDeduction = await AdvanceRepository.findManualDeductionById(id);

    if (!manualDeduction) {
      throw new Error("Manual advance deduction not found");
    }

    ensureAccessToEmployee(manualDeduction.employee.role, currentUserRole);

    if (manualDeduction.lockedByPayrollId) {
      throw new Error("Manual deduction is already locked by generated payroll");
    }

    const deleted = await AdvanceRepository.deleteManualDeduction(id);

    invalidateAdvanceReadCaches();

    return deleted;
  }

  static async updateAdvance(
    id: string,
    data: {
      amount?: number;
      date?: string;
      deductionCycleStartDate?: string;
      note?: string;
      reason: string;
    },
    currentUserRole: Role,
  ) {
    const advance = await AdvanceRepository.findById(id);

    if (!advance) {
      throw new Error("Advance not found");
    }

    ensureAccessToEmployee(advance.employee.role, currentUserRole);

    if (advance.isSettled) {
      throw new Error("Settled advance cannot be updated");
    }

    await assertAdvanceCycleNotLocked({
      employeeId: advance.employeeId,
      cycleStartDate: advance.cycleStartDate,
      cycleEndDate: advance.cycleEndDate,
    });

    const nextAdvanceDate = data.date ? parseDateOnly(data.date) : advance.date;
    ensureNotFutureDate(nextAdvanceDate);
    ensureDateOnOrAfterJoining({
      date: nextAdvanceDate,
      joiningDate: advance.employee.joiningDate,
      action: "Advance date",
    });

    const setting = await AdvanceRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

    const cycle =
      advance.employee.advanceDeductionMode === AdvanceDeductionMode.MANUAL
        ? calculateAdvanceDateCycle({
            salaryType: advance.employee.salaryType,
            advanceDate: nextAdvanceDate,
            weekStartsOn,
          })
        : calculateCycle({
            salaryType: advance.employee.salaryType,
            advanceDate: nextAdvanceDate,
            deductionCycleStartDate: data.deductionCycleStartDate
              ? parseDateOnly(data.deductionCycleStartDate)
              : advance.cycleStartDate,
            weekStartsOn,
          });

    if (advance.employee.advanceDeductionMode === AdvanceDeductionMode.AUTO) {
      ensureDateOnOrAfterJoining({
        date: cycle.cycleStartDate,
        joiningDate: advance.employee.joiningDate,
        action: "Advance deduction cycle start",
      });

      await assertAdvanceCycleNotLocked({
        employeeId: advance.employeeId,
        cycleStartDate: cycle.cycleStartDate,
        cycleEndDate: cycle.cycleEndDate,
      });
    }

    const updateData: {
      amount?: number;
      remainingAmount?: number;
      date?: Date;
      cycleStartDate?: Date;
      cycleEndDate?: Date;
      note?: string;
    } = {};

    if (data.amount !== undefined) {
      updateData.amount = data.amount;
      updateData.remainingAmount = data.amount;
    }

    if (data.date) {
      updateData.date = nextAdvanceDate;
    }

    if (
      data.deductionCycleStartDate ||
      advance.employee.advanceDeductionMode === AdvanceDeductionMode.MANUAL
    ) {
      updateData.cycleStartDate = cycle.cycleStartDate;
      updateData.cycleEndDate = cycle.cycleEndDate;
    }

    if (data.note !== undefined) {
      updateData.note = data.note;
    }
    if (advance.employee.advanceDeductionMode === AdvanceDeductionMode.AUTO) {
      await ensureSalaryAvailableForAdvanceCycle({
        employeeId: advance.employeeId,
        cycleStartDate: cycle.cycleStartDate,
      });
    }
    const updatedAdvance = await AdvanceRepository.update(id, updateData);

    invalidateAdvanceReadCaches();

    return updatedAdvance;
  }

  static async deleteAdvance(
    id: string,
    currentUserRole: Role,
    reason: string,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can delete advance");
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error("Delete reason is required");
    }

    const advance = await AdvanceRepository.findById(id);

    if (!advance) {
      throw new Error("Advance not found");
    }

    if (advance.isSettled) {
      throw new Error("Settled advance cannot be deleted");
    }

    await assertAdvanceCycleNotLocked({
      employeeId: advance.employeeId,
      cycleStartDate: advance.cycleStartDate,
      cycleEndDate: advance.cycleEndDate,
    });

    const deletedAdvance = await AdvanceRepository.delete(id);

    invalidateAdvanceReadCaches();

    return deletedAdvance;
  }
}
