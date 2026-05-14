"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const client_1 = require("@prisma/client");
const scheduler_repository_1 = require("./scheduler.repository");
const payroll_service_1 = require("../payroll/payroll.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const formatDate = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
};
const addMonths = (date, months) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
};
const startOfMonth = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};
const endOfMonth = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};
const getWeekStart = (date, weekStartsOn) => {
    const day = date.getUTCDay();
    const startDay = weekStartsOn === client_1.WeekStartsOn.MONDAY ? 1 : 0;
    const diff = (day - startDay + 7) % 7;
    return addDays(date, -diff);
};
const getWeeklyEndSaturday = (weekStart) => {
    const diff = (6 - weekStart.getUTCDay() + 7) % 7;
    return addDays(weekStart, diff);
};
const todayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const isSameDate = (a, b) => formatDate(a) === formatDate(b);
const getNextPeriod = (salaryType, previousPeriodEnd, weekStartsOn) => {
    if (salaryType === client_1.SalaryType.MONTHLY) {
        const nextMonthStart = startOfMonth(addMonths(previousPeriodEnd, 1));
        return {
            periodStart: nextMonthStart,
            periodEnd: endOfMonth(nextMonthStart),
        };
    }
    const nextWeekStart = getWeekStart(addDays(previousPeriodEnd, 1), weekStartsOn);
    return {
        periodStart: nextWeekStart,
        periodEnd: getWeeklyEndSaturday(nextWeekStart),
    };
};
const getFirstEligiblePeriod = (salaryType, baseDate, weekStartsOn) => {
    if (salaryType === client_1.SalaryType.MONTHLY) {
        const monthStart = startOfMonth(baseDate);
        return {
            periodStart: monthStart,
            periodEnd: endOfMonth(monthStart),
        };
    }
    const weekStart = getWeekStart(baseDate, weekStartsOn);
    return {
        periodStart: weekStart,
        periodEnd: getWeeklyEndSaturday(weekStart),
    };
};
class SchedulerService {
    static async runPayrollScheduler(triggeredBy = "CRON") {
        const startedAt = new Date();
        const run = await scheduler_repository_1.SchedulerRepository.createRun({
            name: "PAYROLL_SCHEDULER",
            startedAt,
            success: false,
            metadata: {
                triggeredBy,
                startedAt,
            },
        });
        const result = {
            triggeredBy,
            totalEmployees: 0,
            successCount: 0,
            skippedCount: 0,
            failureCount: 0,
            generated: [],
            skipped: [],
            failed: [],
        };
        try {
            const employees = await scheduler_repository_1.SchedulerRepository.getActiveEmployees();
            result.totalEmployees = employees.length;
            const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
            const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
            const currentDate = todayUtc();
            for (const employee of employees) {
                try {
                    const firstSalary = await scheduler_repository_1.SchedulerRepository.getFirstSalaryHistory(employee.id);
                    if (!firstSalary) {
                        result.skippedCount++;
                        result.skipped.push({
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            reason: "No salary history found",
                        });
                        continue;
                    }
                    const latestPayroll = await scheduler_repository_1.SchedulerRepository.getLatestPayroll(employee.id);
                    let nextPeriod;
                    if (latestPayroll) {
                        nextPeriod = getNextPeriod(employee.salaryType, latestPayroll.periodEnd, weekStartsOn);
                    }
                    else {
                        const baseDate = employee.joiningDate > firstSalary.effectiveFrom
                            ? employee.joiningDate
                            : firstSalary.effectiveFrom;
                        nextPeriod = getFirstEligiblePeriod(employee.salaryType, baseDate, weekStartsOn);
                    }
                    while (nextPeriod.periodEnd < currentDate) {
                        if (employee.joiningDate > nextPeriod.periodEnd) {
                            result.skippedCount++;
                            result.skipped.push({
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                periodStart: formatDate(nextPeriod.periodStart),
                                periodEnd: formatDate(nextPeriod.periodEnd),
                                reason: "Employee joined after this period",
                            });
                            nextPeriod = getNextPeriod(employee.salaryType, nextPeriod.periodEnd, weekStartsOn);
                            continue;
                        }
                        const existingPayroll = await scheduler_repository_1.SchedulerRepository.findPayroll(employee.id, nextPeriod.periodStart, nextPeriod.periodEnd);
                        if (existingPayroll) {
                            result.skippedCount++;
                            result.skipped.push({
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                periodStart: formatDate(nextPeriod.periodStart),
                                periodEnd: formatDate(nextPeriod.periodEnd),
                                reason: "Payroll already exists",
                            });
                            nextPeriod = getNextPeriod(employee.salaryType, nextPeriod.periodEnd, weekStartsOn);
                            continue;
                        }
                        const payroll = await payroll_service_1.PayrollService.generate({
                            employeeId: employee.id,
                            periodStart: formatDate(nextPeriod.periodStart),
                            periodEnd: formatDate(nextPeriod.periodEnd),
                        }, "SUPER_ADMIN");
                        result.successCount++;
                        result.generated.push({
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            periodStart: formatDate(nextPeriod.periodStart),
                            periodEnd: formatDate(nextPeriod.periodEnd),
                            payroll,
                        });
                        nextPeriod = getNextPeriod(employee.salaryType, nextPeriod.periodEnd, weekStartsOn);
                    }
                    if (!latestPayroll && nextPeriod.periodEnd >= currentDate) {
                        result.skippedCount++;
                        result.skipped.push({
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            reason: "No completed payroll period available yet",
                        });
                    }
                }
                catch (error) {
                    result.failureCount++;
                    result.failed.push({
                        employeeId: employee.id,
                        employeeCode: employee.employeeCode,
                        error: error instanceof Error ? error.message : "Unknown error",
                    });
                }
            }
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                finishedAt: new Date(),
                success: result.failureCount === 0,
                metadata: result,
            });
            return result;
        }
        catch (error) {
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                finishedAt: new Date(),
                success: false,
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                metadata: result,
            });
            throw error;
        }
    }
    static async listRuns(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [runs, total] = await scheduler_repository_1.SchedulerRepository.listRuns({
            skip,
            take,
        });
        return {
            data: runs,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.service.js.map