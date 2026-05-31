import { Prisma, Role, SalaryType, WeekStartsOn } from "@prisma/client";
import { AdvanceRepository } from "./advance.repository";
import { LedgerService } from "../ledger/ledger.service";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { assertAdvanceCycleNotLocked } from "../../shared/payroll/payroll-lock.util";
import { CacheService } from "../../utils/cache";

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const roundMoney = (amount: number) => Math.round(amount * 100) / 100;
const ADVANCE_READ_CACHE_PREFIX = "advance-read";
const ADVANCE_READ_CACHE_TTL = 30;

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
  const now = new Date();
  const todayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (date > todayUtc) {
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
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
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
      deductionCycleStartDate: string;
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

    await ensureSalaryAvailableForAdvanceCycle({
      employeeId: employee.id,
      cycleStartDate: cycle.cycleStartDate,
    });
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
    const { directEmployeeId, employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const isSettled =
      query.isSettled === undefined ? undefined : query.isSettled === "true";
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "list",
      authUser.role,
      authUser.id,
      query.employeeId ?? "all",
      isSettled === undefined ? "all" : String(isSettled),
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
    } = {
      skip,
      take,
      ...(directEmployeeId && { employeeId: directEmployeeId }),
      employeeWhere,
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
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "my",
      employeeId,
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(employeeId, { skip, take }),
      AdvanceRepository.countByEmployee(employeeId),
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
    const cacheKey = CacheService.buildKey(
      ADVANCE_READ_CACHE_PREFIX,
      "employee",
      employeeId,
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(employeeId, { skip, take }),
      AdvanceRepository.countByEmployee(employeeId),
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
    const nextDeductionCycleStart = data.deductionCycleStartDate
      ? parseDateOnly(data.deductionCycleStartDate)
      : advance.cycleStartDate;

    ensureNotFutureDate(nextAdvanceDate);
    ensureDateOnOrAfterJoining({
      date: nextAdvanceDate,
      joiningDate: advance.employee.joiningDate,
      action: "Advance date",
    });

    const setting = await AdvanceRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

    const cycle = calculateCycle({
      salaryType: advance.employee.salaryType,
      advanceDate: nextAdvanceDate,
      deductionCycleStartDate: nextDeductionCycleStart,
      weekStartsOn,
    });
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

    if (data.deductionCycleStartDate) {
      updateData.cycleStartDate = cycle.cycleStartDate;
      updateData.cycleEndDate = cycle.cycleEndDate;
    }

    if (data.note !== undefined) {
      updateData.note = data.note;
    }
    await ensureSalaryAvailableForAdvanceCycle({
      employeeId: advance.employeeId,
      cycleStartDate: cycle.cycleStartDate,
    });
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
