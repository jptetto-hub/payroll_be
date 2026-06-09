"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvanceService = void 0;
const client_1 = require("@prisma/client");
const advance_repository_1 = require("./advance.repository");
const ledger_service_1 = require("../ledger/ledger.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const cache_1 = require("../../utils/cache");
const business_date_util_1 = require("../../shared/time/business-date.util");
const salary_calculation_service_1 = require("../salary-calculation/salary-calculation.service");
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const parseOptionalDateOnly = (value) => {
    if (typeof value !== "string" || !value.trim()) {
        return undefined;
    }
    return parseDateOnly(value);
};
const parseDateRange = (query) => {
    const from = parseOptionalDateOnly(query.from);
    const to = parseOptionalDateOnly(query.to);
    if (from && to && from > to) {
        throw new Error("From date cannot be greater than To date");
    }
    return { from, to };
};
const parseOptionalBooleanQuery = (value) => {
    if (value === undefined || value === "") {
        return undefined;
    }
    return value === "true" || value === true;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const roundMoney = (amount) => Math.round(amount * 100) / 100;
const toMoneyNumber = (value) => roundMoney(Number(value ?? 0));
const toOptionalMoneyNumber = (value) => value === null || value === undefined ? null : toMoneyNumber(value);
const ADVANCE_READ_CACHE_PREFIX = "advance-read";
const ADVANCE_READ_CACHE_TTL = 30;
const invalidateAdvanceReadCaches = () => {
    void Promise.all([
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
        cache_1.CacheService.delByPattern("advance-summary:*"),
        cache_1.CacheService.delByPattern(`${ADVANCE_READ_CACHE_PREFIX}:*`),
        cache_1.CacheService.delByPattern("ledger-read:*"),
    ]);
};
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
const ensureNotFutureDate = (date) => {
    if (date > (0, business_date_util_1.getBusinessDate)()) {
        throw new Error("Future advance date is not allowed");
    }
};
const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
};
const addMonths = (date, months) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
};
const getMonthStart = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};
const getMonthEnd = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};
const getWeekStart = (date, weekStartsOn) => {
    const day = date.getUTCDay();
    const startDay = weekStartsOn === "MONDAY" ? 1 : 0;
    const diff = (day - startDay + 7) % 7;
    return addDays(date, -diff);
};
const getWeeklyCycleEndSaturday = (cycleStartDate) => {
    const day = cycleStartDate.getUTCDay();
    const saturday = 6;
    const diff = (saturday - day + 7) % 7;
    return addDays(cycleStartDate, diff);
};
const isSameDate = (a, b) => formatDate(a) === formatDate(b);
const ensureAccessToEmployee = (targetEmployeeRole, currentUserRole) => {
    if (currentUserRole === client_1.Role.ADMIN && targetEmployeeRole !== client_1.Role.USER) {
        throw new Error("ADMIN can manage advances only for USER employees");
    }
};
const ensureSalaryAvailableForAdvanceCycle = async (params) => {
    const salary = await advance_repository_1.AdvanceRepository.getSalaryForDate(params.employeeId, params.cycleStartDate);
    if (!salary) {
        throw new Error("Cannot process advance because salary history is not available for selected deduction cycle");
    }
};
const getManualDeductionSalaryCapacity = async (params) => {
    const preview = await salary_calculation_service_1.SalaryCalculationService.preview({
        employeeId: params.employee.id,
        periodStart: formatDate(params.periodStart),
        periodEnd: formatDate(params.periodEnd),
    }, {
        employee: params.employee,
        skipActivePayrollSnapshot: params.skipActivePayrollSnapshot ?? true,
        manualDeductionAmountOverride: params.manualDeductionAmountOverride ?? 0,
    });
    return roundMoney(Number(preview.result.grossSalary ?? 0));
};
const calculateCycle = (params) => {
    const { salaryType, advanceDate, deductionCycleStartDate, weekStartsOn } = params;
    if (salaryType === client_1.SalaryType.WEEKLY) {
        const currentWeekStart = getWeekStart(advanceDate, weekStartsOn);
        const expectedWeekStart = getWeekStart(deductionCycleStartDate, weekStartsOn);
        if (!isSameDate(deductionCycleStartDate, expectedWeekStart)) {
            throw new Error(`Weekly deduction cycle must start on configured week start day: ${weekStartsOn}`);
        }
        const maxAllowedStart = addDays(currentWeekStart, 14);
        if (deductionCycleStartDate < currentWeekStart) {
            throw new Error("Deduction cycle cannot be before advance date cycle");
        }
        if (deductionCycleStartDate > maxAllowedStart) {
            throw new Error("Weekly advance deduction cannot go beyond 3 weekly cycles");
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
        throw new Error("Monthly advance deduction cannot go beyond 3 monthly cycles");
    }
    return {
        cycleStartDate: deductionCycleStartDate,
        cycleEndDate: getMonthEnd(deductionCycleStartDate),
    };
};
const calculateAdvanceDateCycle = (params) => {
    if (params.salaryType === client_1.SalaryType.WEEKLY) {
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
const validatePayrollPeriodLikeEmployeeCycle = async (params) => {
    const setting = await advance_repository_1.AdvanceRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
    if (params.employeeSalaryType === client_1.SalaryType.MONTHLY) {
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
        throw new Error(`Weekly manual deduction period must start on configured week start day: ${weekStartsOn}`);
    }
    if (!isSameDate(params.periodEnd, getWeeklyCycleEndSaturday(params.periodStart))) {
        throw new Error("Weekly manual deduction period must end on Saturday");
    }
};
class AdvanceService {
    static async deductionPreview(data, currentUserRole) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(data.employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAccessToEmployee(employee.role, currentUserRole);
        if (employee.advanceDeductionMode === client_1.AdvanceDeductionMode.MANUAL) {
            throw new Error("This employee uses manual advance deduction. Enter the cycle deduction amount from the advance module instead of using auto deduction preview.");
        }
        const advanceDate = parseDateOnly(data.date);
        const deductionCycleStartDate = parseDateOnly(data.deductionCycleStartDate);
        ensureNotFutureDate(advanceDate);
        ensureDateOnOrAfterJoining({
            date: advanceDate,
            joiningDate: employee.joiningDate,
            action: "Advance date",
        });
        const setting = await advance_repository_1.AdvanceRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
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
        await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
            employeeId: employee.id,
            cycleStartDate: cycle.cycleStartDate,
            cycleEndDate: cycle.cycleEndDate,
        });
        const [salary, existingAdvances, pendingCarryForwards, unprocessedEarlierAdvances,] = await Promise.all([
            advance_repository_1.AdvanceRepository.getSalaryForDate(employee.id, cycle.cycleStartDate),
            advance_repository_1.AdvanceRepository.getAdvancesForCycle(employee.id, cycle.cycleStartDate, cycle.cycleEndDate, data.excludeAdvanceId),
            advance_repository_1.AdvanceRepository.getPendingCarryForwardsBeforeCycle(employee.id, cycle.cycleStartDate),
            advance_repository_1.AdvanceRepository.getUnprocessedEarlierAdvances(employee.id, cycle.cycleStartDate),
        ]);
        if (!salary) {
            throw new Error("Cannot preview advance because salary history is not available for selected deduction cycle");
        }
        const referenceSalary = roundMoney(Number(salary.salaryAmount));
        const existingAdvanceTotal = roundMoney(existingAdvances.reduce((total, advance) => total + Number(advance.remainingAmount), 0));
        const requestedAdvance = roundMoney(data.amount);
        const selectedCycleAdvanceTotal = roundMoney(existingAdvanceTotal + requestedAdvance);
        let availableAfterCycleAdvances = Math.max(roundMoney(referenceSalary - selectedCycleAdvanceTotal), 0);
        const projectedCarryForwardApplications = [];
        for (const item of pendingCarryForwards) {
            const remainingAmount = roundMoney(Number(item.remainingAmount));
            const appliedAmount = roundMoney(Math.min(remainingAmount, availableAfterCycleAdvances));
            projectedCarryForwardApplications.push({
                id: item.id,
                sourcePayrollId: item.sourcePayrollId,
                sourceCycleStartDate: formatDate(item.cycleStartDate),
                sourceCycleEndDate: formatDate(item.cycleEndDate),
                remainingAmount,
                appliedAmount,
                remainingAfterApplication: roundMoney(remainingAmount - appliedAmount),
            });
            availableAfterCycleAdvances = roundMoney(availableAfterCycleAdvances - appliedAmount);
        }
        const earlierBalanceAvailable = roundMoney(pendingCarryForwards.reduce((total, item) => total + Number(item.remainingAmount), 0));
        const earlierBalanceApplied = roundMoney(projectedCarryForwardApplications.reduce((total, item) => total + item.appliedAmount, 0));
        const earlierBalanceRemaining = roundMoney(earlierBalanceAvailable - earlierBalanceApplied);
        const selectedCycleOverflow = Math.max(roundMoney(selectedCycleAdvanceTotal - referenceSalary), 0);
        const projectedTotalDeduction = roundMoney(selectedCycleAdvanceTotal + earlierBalanceApplied);
        const projectedPayableSalary = Math.max(roundMoney(referenceSalary - projectedTotalDeduction), 0);
        const projectedBalanceCarriedOnward = roundMoney(selectedCycleOverflow + earlierBalanceRemaining);
        const today = (0, business_date_util_1.getBusinessDate)();
        const attendanceState = cycle.cycleStartDate > today
            ? "FUTURE_CYCLE"
            : cycle.cycleEndDate >= today
                ? "CURRENT_CYCLE"
                : "PAST_CYCLE";
        const unprocessedEarlierCycles = [
            ...new Map(unprocessedEarlierAdvances.map((advance) => {
                const cycleKey = `${formatDate(advance.cycleStartDate)}_${formatDate(advance.cycleEndDate)}`;
                return [
                    cycleKey,
                    {
                        startDate: formatDate(advance.cycleStartDate),
                        endDate: formatDate(advance.cycleEndDate),
                    },
                ];
            })).values(),
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
    static async createAdvance(data, currentUserRole) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(data.employeeId);
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
        const setting = await advance_repository_1.AdvanceRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
        let cycle;
        if (employee.advanceDeductionMode === client_1.AdvanceDeductionMode.MANUAL) {
            cycle = calculateAdvanceDateCycle({
                salaryType: employee.salaryType,
                advanceDate,
                weekStartsOn,
            });
            await ensureSalaryAvailableForAdvanceCycle({
                employeeId: employee.id,
                cycleStartDate: cycle.cycleStartDate,
            });
        }
        else {
            if (!data.deductionCycleStartDate) {
                throw new Error("Deduction cycle is required for auto deduction mode");
            }
            const deductionCycleStartDate = parseDateOnly(data.deductionCycleStartDate);
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
            await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
                employeeId: employee.id,
                cycleStartDate: cycle.cycleStartDate,
                cycleEndDate: cycle.cycleEndDate,
            });
            await ensureSalaryAvailableForAdvanceCycle({
                employeeId: employee.id,
                cycleStartDate: cycle.cycleStartDate,
            });
        }
        const advance = await advance_repository_1.AdvanceRepository.create({
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
        const ledgerEntry = await ledger_service_1.LedgerService.createAdvanceLedger({
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
    static async listAdvances(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const dateRange = parseDateRange(query);
        const { directEmployeeId, employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const isSettled = parseOptionalBooleanQuery(query.isSettled);
        const cacheKey = cache_1.CacheService.buildKey(ADVANCE_READ_CACHE_PREFIX, "list", authUser.role, authUser.id, query.employeeId ?? "all", isSettled === undefined ? "all" : String(isSettled), dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const listParams = {
            skip,
            take,
            ...(directEmployeeId && { employeeId: directEmployeeId }),
            employeeWhere,
            ...dateRange,
        };
        if (isSettled !== undefined) {
            listParams.isSettled = isSettled;
        }
        const [advances, total] = await advance_repository_1.AdvanceRepository.listAll(listParams);
        const result = {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);
        return result;
    }
    static async myAdvances(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const dateRange = parseDateRange(query);
        const isSettled = parseOptionalBooleanQuery(query.isSettled);
        const cacheKey = cache_1.CacheService.buildKey(ADVANCE_READ_CACHE_PREFIX, "my", employeeId, isSettled === undefined ? "all" : String(isSettled), dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [advances, total] = await Promise.all([
            advance_repository_1.AdvanceRepository.listByEmployee(employeeId, { skip, take }, { ...dateRange, isSettled }),
            advance_repository_1.AdvanceRepository.countByEmployee(employeeId, {
                ...dateRange,
                isSettled,
            }),
        ]);
        const result = {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);
        return result;
    }
    static async getAdvanceById(id, currentUser) {
        const advance = await advance_repository_1.AdvanceRepository.findById(id);
        if (!advance) {
            throw new Error("Advance not found");
        }
        if (currentUser.role === client_1.Role.USER &&
            advance.employeeId !== currentUser.id) {
            throw new Error("You can view only your own advance");
        }
        ensureAccessToEmployee(advance.employee.role, currentUser.role);
        return advance;
    }
    static async listByEmployee(employeeId, currentUserRole, query) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAccessToEmployee(employee.role, currentUserRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const dateRange = parseDateRange(query);
        const isSettled = parseOptionalBooleanQuery(query.isSettled);
        const cacheKey = cache_1.CacheService.buildKey(ADVANCE_READ_CACHE_PREFIX, "employee", employeeId, isSettled === undefined ? "all" : String(isSettled), dateRange.from ? formatDate(dateRange.from) : "any-from", dateRange.to ? formatDate(dateRange.to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [advances, total] = await Promise.all([
            advance_repository_1.AdvanceRepository.listByEmployee(employeeId, { skip, take }, { ...dateRange, isSettled }),
            advance_repository_1.AdvanceRepository.countByEmployee(employeeId, {
                ...dateRange,
                isSettled,
            }),
        ]);
        const result = {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, ADVANCE_READ_CACHE_TTL);
        return result;
    }
    static async listByCycle(employeeId, cycleStartDateValue, cycleEndDateValue, currentUserRole) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAccessToEmployee(employee.role, currentUserRole);
        const cycleStartDate = parseDateOnly(cycleStartDateValue);
        const cycleEndDate = parseDateOnly(cycleEndDateValue);
        if (cycleStartDate > cycleEndDate) {
            throw new Error("cycleStartDate cannot be greater than cycleEndDate");
        }
        const cacheKey = cache_1.CacheService.buildKey(ADVANCE_READ_CACHE_PREFIX, "cycle", employeeId, cycleStartDateValue, cycleEndDateValue);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const advances = await advance_repository_1.AdvanceRepository.listByCycle(employeeId, cycleStartDate, cycleEndDate);
        void cache_1.CacheService.set(cacheKey, advances, ADVANCE_READ_CACHE_TTL);
        return advances;
    }
    static async getManualDeduction(employeeId, periodStartValue, periodEndValue, currentUserRole) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAccessToEmployee(employee.role, currentUserRole);
        const periodStart = parseDateOnly(periodStartValue);
        const periodEnd = parseDateOnly(periodEndValue);
        if (periodStart > periodEnd) {
            throw new Error("periodStart cannot be greater than periodEnd");
        }
        const [manualDeduction, outstandingAdvances, advanceHistory] = await Promise.all([
            advance_repository_1.AdvanceRepository.getManualDeduction(employee.id, periodStart, periodEnd),
            advance_repository_1.AdvanceRepository.getOutstandingAdvances(employee.id, periodEnd),
            advance_repository_1.AdvanceRepository.getAdvanceHistoryUntil(employee.id, periodEnd),
        ]);
        const payrollSnapshot = manualDeduction?.lockedByPayrollId
            ? await advance_repository_1.AdvanceRepository.getPayrollSnapshot(manualDeduction.lockedByPayrollId)
            : null;
        const snapshotAdvanceBreakdown = payrollSnapshot?.advanceBreakdown ?? null;
        const snapshotOutstandingTotal = toOptionalMoneyNumber(snapshotAdvanceBreakdown?.manualOutstandingTotal);
        const snapshotDeductionAmount = payrollSnapshot
            ? toOptionalMoneyNumber(snapshotAdvanceBreakdown?.advanceDeduction ??
                payrollSnapshot.advanceDeduction ??
                manualDeduction?.amount)
            : null;
        const snapshotSalaryPayableAmount = payrollSnapshot
            ? toMoneyNumber(payrollSnapshot.grossSalary)
            : null;
        const snapshotBalanceAfterDeduction = snapshotOutstandingTotal !== null && snapshotDeductionAmount !== null
            ? Math.max(roundMoney(snapshotOutstandingTotal - snapshotDeductionAmount), 0)
            : null;
        const outstandingTotal = roundMoney(outstandingAdvances.reduce((sum, advance) => sum + Number(advance.remainingAmount), 0));
        const totalAdvanceReceived = roundMoney(advanceHistory.reduce((sum, advance) => sum + Number(advance.amount), 0));
        const totalAdvanceDeducted = roundMoney(advanceHistory.reduce((sum, advance) => sum + Number(advance.settledAmount ?? 0), 0));
        const currentCycleAdvances = advanceHistory.filter((advance) => advance.date >= periodStart &&
            advance.date <= periodEnd);
        const cycleAdvanceReceived = roundMoney(currentCycleAdvances.reduce((sum, advance) => sum + Number(advance.amount), 0));
        const cycleAdvanceDeducted = roundMoney(currentCycleAdvances.reduce((sum, advance) => sum + Number(advance.settledAmount ?? 0), 0));
        const cycleDeductionAmount = roundMoney(Number(manualDeduction?.amount ?? 0));
        let salaryPayableAmount = null;
        let salaryCapacityError = null;
        if (snapshotSalaryPayableAmount !== null) {
            salaryPayableAmount = snapshotSalaryPayableAmount;
        }
        else {
            try {
                salaryPayableAmount = await getManualDeductionSalaryCapacity({
                    employee,
                    periodStart,
                    periodEnd,
                    skipActivePayrollSnapshot: !manualDeduction?.lockedByPayrollId,
                });
            }
            catch (error) {
                salaryCapacityError =
                    error instanceof Error
                        ? error.message
                        : "Unable to calculate salary capacity";
            }
        }
        const effectiveOutstandingTotal = snapshotOutstandingTotal ?? outstandingTotal;
        const effectiveDeductionAmount = snapshotDeductionAmount ?? cycleDeductionAmount;
        const balanceAfterSavedDeduction = snapshotBalanceAfterDeduction ??
            (manualDeduction
                ? Math.max(roundMoney(effectiveOutstandingTotal - Number(manualDeduction.amount)), 0)
                : effectiveOutstandingTotal);
        const maxDeductibleAmount = salaryPayableAmount === null
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
            outstandingAdvances: advanceHistory,
            currentCycleAdvances,
        };
    }
    static async upsertManualDeduction(data, currentUserRole, currentUserId) {
        const employee = await advance_repository_1.AdvanceRepository.findEmployee(data.employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureAccessToEmployee(employee.role, currentUserRole);
        if (employee.advanceDeductionMode !== client_1.AdvanceDeductionMode.MANUAL) {
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
        const existing = await advance_repository_1.AdvanceRepository.getManualDeduction(employee.id, periodStart, periodEnd);
        if (existing?.lockedByPayrollId) {
            throw new Error("Manual deduction is already locked by generated payroll");
        }
        const outstandingAdvances = await advance_repository_1.AdvanceRepository.getOutstandingAdvances(employee.id, periodEnd);
        const outstandingTotal = roundMoney(outstandingAdvances.reduce((sum, advance) => sum + Number(advance.remainingAmount), 0));
        if (data.amount > outstandingTotal) {
            throw new Error(`Manual deduction cannot exceed pending advance balance ${outstandingTotal}`);
        }
        const salaryPayableAmount = await getManualDeductionSalaryCapacity({
            employee,
            periodStart,
            periodEnd,
            manualDeductionAmountOverride: data.amount,
        });
        if (data.amount > salaryPayableAmount) {
            throw new Error(`Manual advance deduction cannot exceed payable salary ${salaryPayableAmount}. You can deduct up to ${salaryPayableAmount} for this cycle.`);
        }
        const manualDeduction = await advance_repository_1.AdvanceRepository.upsertManualDeduction({
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
    static async deleteManualDeduction(id, currentUserRole) {
        const manualDeduction = await advance_repository_1.AdvanceRepository.findManualDeductionById(id);
        if (!manualDeduction) {
            throw new Error("Manual advance deduction not found");
        }
        ensureAccessToEmployee(manualDeduction.employee.role, currentUserRole);
        if (manualDeduction.lockedByPayrollId) {
            throw new Error("Manual deduction is already locked by generated payroll");
        }
        const deleted = await advance_repository_1.AdvanceRepository.deleteManualDeduction(id);
        invalidateAdvanceReadCaches();
        return deleted;
    }
    static async updateAdvance(id, data, currentUserRole) {
        const advance = await advance_repository_1.AdvanceRepository.findById(id);
        if (!advance) {
            throw new Error("Advance not found");
        }
        ensureAccessToEmployee(advance.employee.role, currentUserRole);
        if (advance.isSettled) {
            throw new Error("Settled advance cannot be updated");
        }
        await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
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
        const setting = await advance_repository_1.AdvanceRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
        const cycle = advance.employee.advanceDeductionMode === client_1.AdvanceDeductionMode.MANUAL
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
        if (advance.employee.advanceDeductionMode === client_1.AdvanceDeductionMode.AUTO) {
            ensureDateOnOrAfterJoining({
                date: cycle.cycleStartDate,
                joiningDate: advance.employee.joiningDate,
                action: "Advance deduction cycle start",
            });
            await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
                employeeId: advance.employeeId,
                cycleStartDate: cycle.cycleStartDate,
                cycleEndDate: cycle.cycleEndDate,
            });
        }
        const updateData = {};
        if (data.amount !== undefined) {
            updateData.amount = data.amount;
            updateData.remainingAmount = data.amount;
        }
        if (data.date) {
            updateData.date = nextAdvanceDate;
        }
        if (data.deductionCycleStartDate ||
            advance.employee.advanceDeductionMode === client_1.AdvanceDeductionMode.MANUAL) {
            updateData.cycleStartDate = cycle.cycleStartDate;
            updateData.cycleEndDate = cycle.cycleEndDate;
        }
        if (data.note !== undefined) {
            updateData.note = data.note;
        }
        if (advance.employee.advanceDeductionMode === client_1.AdvanceDeductionMode.AUTO) {
            await ensureSalaryAvailableForAdvanceCycle({
                employeeId: advance.employeeId,
                cycleStartDate: cycle.cycleStartDate,
            });
        }
        const updatedAdvance = await advance_repository_1.AdvanceRepository.update(id, updateData);
        invalidateAdvanceReadCaches();
        return updatedAdvance;
    }
    static async deleteAdvance(id, currentUserRole, reason) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can delete advance");
        }
        if (!reason || reason.trim().length < 5) {
            throw new Error("Delete reason is required");
        }
        const advance = await advance_repository_1.AdvanceRepository.findById(id);
        if (!advance) {
            throw new Error("Advance not found");
        }
        if (advance.isSettled) {
            throw new Error("Settled advance cannot be deleted");
        }
        await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
            employeeId: advance.employeeId,
            cycleStartDate: advance.cycleStartDate,
            cycleEndDate: advance.cycleEndDate,
        });
        const deletedAdvance = await advance_repository_1.AdvanceRepository.delete(id);
        invalidateAdvanceReadCaches();
        return deletedAdvance;
    }
}
exports.AdvanceService = AdvanceService;
//# sourceMappingURL=advance.service.js.map