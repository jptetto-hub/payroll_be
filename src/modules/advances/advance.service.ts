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

    await Promise.all([
      CacheService.delByPattern("dashboard-summary:*"),
      CacheService.delByPattern("advance-summary:*"),
    ]);

    return {
      advance,
      ledgerEntry,
    };
  }

  static async listAdvances(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const isSettled =
      query.isSettled === undefined ? undefined : query.isSettled === "true";

    const listParams: {
      skip: number;
      take: number;
      employeeWhere?: Prisma.EmployeeWhereInput;
      isSettled?: boolean;
    } = {
      skip,
      take,
      employeeWhere,
    };

    if (isSettled !== undefined) {
      listParams.isSettled = isSettled;
    }

    const [advances, total] = await AdvanceRepository.listAll(listParams);

    return {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async myAdvances(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(employeeId, { skip, take }),
      AdvanceRepository.countByEmployee(employeeId),
    ]);

    return {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };
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
    const [advances, total] = await Promise.all([
      AdvanceRepository.listByEmployee(employeeId, { skip, take }),
      AdvanceRepository.countByEmployee(employeeId),
    ]);

    return {
      data: advances,
      pagination: buildPaginationMeta(total, page, limit),
    };
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

    return AdvanceRepository.listByCycle(
      employeeId,
      cycleStartDate,
      cycleEndDate,
    );
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

    await Promise.all([
      CacheService.delByPattern("dashboard-summary:*"),
      CacheService.delByPattern("advance-summary:*"),
    ]);

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

    await Promise.all([
      CacheService.delByPattern("dashboard-summary:*"),
      CacheService.delByPattern("advance-summary:*"),
    ]);

    return deletedAdvance;
  }
}
