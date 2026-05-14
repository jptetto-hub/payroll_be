"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvanceService = void 0;
const client_1 = require("@prisma/client");
const advance_repository_1 = require("./advance.repository");
const ledger_service_1 = require("../ledger/ledger.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
const ensureNotFutureDate = (date) => {
    const now = new Date();
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    if (date > todayUtc) {
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
const ensureAdvanceWithinSalaryLimit = async (params) => {
    const salary = await advance_repository_1.AdvanceRepository.getSalaryForDate(params.employeeId, params.cycleStartDate);
    if (!salary) {
        throw new Error("Cannot create advance because salary history is not available for selected deduction cycle");
    }
    const existingAdvances = await advance_repository_1.AdvanceRepository.getAdvancesForCycle(params.employeeId, params.cycleStartDate, params.cycleEndDate, params.excludeAdvanceId);
    const existingAdvanceTotal = existingAdvances.reduce((sum, item) => sum + Number(item.remainingAmount), 0);
    const salaryAmount = Number(salary.salaryAmount);
    const availableAdvanceLimit = salaryAmount - existingAdvanceTotal;
    if (params.newAmount > availableAdvanceLimit) {
        throw new Error(`Advance amount exceeds available salary balance for selected cycle. Salary: ${salaryAmount}, Existing advances: ${existingAdvanceTotal}, Available: ${availableAdvanceLimit}`);
    }
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
class AdvanceService {
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
        await ensureAdvanceWithinSalaryLimit({
            employeeId: employee.id,
            cycleStartDate: cycle.cycleStartDate,
            cycleEndDate: cycle.cycleEndDate,
            newAmount: data.amount,
        });
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
        return {
            advance,
            ledgerEntry,
        };
    }
    static async listAdvances(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const isSettled = query.isSettled === undefined ? undefined : query.isSettled === "true";
        const listParams = {
            skip,
            take,
            employeeWhere,
        };
        if (isSettled !== undefined) {
            listParams.isSettled = isSettled;
        }
        const [advances, total] = await advance_repository_1.AdvanceRepository.listAll(listParams);
        return {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async myAdvances(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [advances, total] = await Promise.all([
            advance_repository_1.AdvanceRepository.listByEmployee(employeeId, { skip, take }),
            advance_repository_1.AdvanceRepository.countByEmployee(employeeId),
        ]);
        return {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
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
        const [advances, total] = await Promise.all([
            advance_repository_1.AdvanceRepository.listByEmployee(employeeId, { skip, take }),
            advance_repository_1.AdvanceRepository.countByEmployee(employeeId),
        ]);
        return {
            data: advances,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
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
        return advance_repository_1.AdvanceRepository.listByCycle(employeeId, cycleStartDate, cycleEndDate);
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
        const nextDeductionCycleStart = data.deductionCycleStartDate
            ? parseDateOnly(data.deductionCycleStartDate)
            : advance.cycleStartDate;
        ensureNotFutureDate(nextAdvanceDate);
        ensureDateOnOrAfterJoining({
            date: nextAdvanceDate,
            joiningDate: advance.employee.joiningDate,
            action: "Advance date",
        });
        const setting = await advance_repository_1.AdvanceRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
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
        await (0, payroll_lock_util_1.assertAdvanceCycleNotLocked)({
            employeeId: advance.employeeId,
            cycleStartDate: cycle.cycleStartDate,
            cycleEndDate: cycle.cycleEndDate,
        });
        const updateData = {};
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
        await ensureAdvanceWithinSalaryLimit({
            employeeId: advance.employeeId,
            cycleStartDate: cycle.cycleStartDate,
            cycleEndDate: cycle.cycleEndDate,
            newAmount: data.amount ?? Number(advance.amount),
            excludeAdvanceId: advance.id,
        });
        return advance_repository_1.AdvanceRepository.update(id, updateData);
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
        return advance_repository_1.AdvanceRepository.delete(id);
    }
}
exports.AdvanceService = AdvanceService;
//# sourceMappingURL=advance.service.js.map