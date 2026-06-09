"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const client_1 = require("@prisma/client");
const scheduler_repository_1 = require("./scheduler.repository");
const payroll_service_1 = require("../payroll/payroll.service");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const performanceTimer_1 = require("../../utils/performanceTimer");
const logger_1 = require("../../config/logger");
const business_date_util_1 = require("../../shared/time/business-date.util");
const formatDate = (date) => date.toISOString().slice(0, 10);
async function processWithConcurrency(items, concurrency, processor) {
    let nextIndex = 0;
    const workerCount = Math.min(Math.max(1, concurrency), items.length);
    await Promise.all(Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const item = items[nextIndex++];
            await processor(item);
        }
    }));
}
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
const todayUtc = () => (0, business_date_util_1.getBusinessDate)();
const roundMoney = (amount) => Math.round(amount * 100) / 100;
const getLatestCompletedPeriod = (salaryType, currentDate, weekStartsOn) => {
    if (salaryType === client_1.SalaryType.MONTHLY) {
        let periodStart = startOfMonth(currentDate);
        let periodEnd = endOfMonth(periodStart);
        if (periodEnd > currentDate) {
            periodStart = addMonths(periodStart, -1);
            periodEnd = endOfMonth(periodStart);
        }
        return {
            periodStart,
            periodEnd,
        };
    }
    let periodStart = getWeekStart(currentDate, weekStartsOn);
    let periodEnd = getWeeklyEndSaturday(periodStart);
    if (periodEnd > currentDate) {
        periodStart = addDays(periodStart, -7);
        periodEnd = getWeeklyEndSaturday(periodStart);
    }
    return {
        periodStart,
        periodEnd,
    };
};
class SchedulerService {
    static async recoverStaleRuns() {
        const staleMinutes = Number(process.env.SCHEDULER_STALE_RUN_MINUTES || 60);
        const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000);
        const message = `Marked failed automatically because the scheduler recorded no progress for ${staleMinutes} minutes. Start a new run to retry the current payroll cycle.`;
        const result = await scheduler_repository_1.SchedulerRepository.markStaleActiveRunsFailed({
            staleBefore,
            errorMessage: message,
        });
        if (result.count > 0) {
            logger_1.logger.warn({ count: result.count, staleMinutes }, "Recovered stale payroll scheduler runs");
        }
        return result.count;
    }
    static async countPendingCurrentCyclePayrolls(salaryTypes) {
        const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
        const currentDate = todayUtc();
        const eligibleSalaryTypes = salaryTypes?.length
            ? salaryTypes
            : [client_1.SalaryType.MONTHLY, client_1.SalaryType.WEEKLY];
        const targetPeriods = eligibleSalaryTypes.map((salaryType) => ({
            salaryType,
            ...getLatestCompletedPeriod(salaryType, currentDate, weekStartsOn),
        }));
        return scheduler_repository_1.SchedulerRepository.countPendingActiveEmployees(targetPeriods);
    }
    static async getManualAdvanceDeductionReminders(salaryTypes) {
        const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
        const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
        const currentDate = todayUtc();
        const eligibleSalaryTypes = salaryTypes?.length
            ? salaryTypes
            : [client_1.SalaryType.MONTHLY, client_1.SalaryType.WEEKLY];
        const targetPeriods = eligibleSalaryTypes.map((salaryType) => ({
            salaryType,
            ...getLatestCompletedPeriod(salaryType, currentDate, weekStartsOn),
        }));
        const employees = await scheduler_repository_1.SchedulerRepository.findManualAdvanceReminderEmployees(targetPeriods);
        const items = employees.map((employee) => {
            const outstandingTotal = roundMoney(employee.advances.reduce((sum, advance) => sum + Number(advance.remainingAmount), 0));
            return {
                employeeId: employee.id,
                employeeCode: employee.employeeCode,
                employeeName: employee.name,
                salaryType: employee.salaryType,
                periodStart: formatDate(employee.periodStart),
                periodEnd: formatDate(employee.periodEnd),
                outstandingTotal,
                advanceCount: employee.advances.length,
            };
        });
        return {
            generatedAt: new Date().toISOString(),
            message: items.length > 0
                ? "Manual advance deduction amounts are pending for upcoming payroll."
                : "No manual advance deduction reminders pending.",
            items,
            count: items.length,
        };
    }
    static async runPayrollScheduler(triggeredBy = "CRON", options = {}) {
        const timer = new performanceTimer_1.PerformanceTimer("SchedulerService.runPayrollScheduler");
        timer.checkpoint("start");
        const startedAt = new Date();
        const BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE || 100);
        const EMPLOYEE_CONCURRENCY = Number(process.env.SCHEDULER_EMPLOYEE_CONCURRENCY || 1);
        const STORE_ITEM_DETAILS = process.env.SCHEDULER_STORE_ITEM_DETAILS === "true" ||
            process.env.SCHEDULER_STORE_SUCCESS_ITEMS === "true";
        const MAX_RESULT_ITEMS = Number(process.env.SCHEDULER_MAX_RESULT_ITEMS || 1000);
        const addResultItem = (items, item) => {
            if (items.length < MAX_RESULT_ITEMS) {
                items.push(item);
            }
        };
        const run = options.runId
            ? { id: options.runId }
            : await scheduler_repository_1.SchedulerRepository.createRun({
                name: "PAYROLL_SCHEDULER",
                status: client_1.SchedulerRunStatus.RUNNING,
                startedAt,
                metadata: {
                    triggeredBy,
                    triggeredByUserId: options.triggeredByUserId,
                    mode: options.mode ?? triggeredBy,
                    salaryTypes: options.salaryTypes,
                    periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
                    startedAt,
                },
            });
        const result = {
            triggeredBy,
            salaryTypes: options.salaryTypes ?? [client_1.SalaryType.MONTHLY, client_1.SalaryType.WEEKLY],
            periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
            employeeConcurrency: EMPLOYEE_CONCURRENCY,
            storesItemDetails: STORE_ITEM_DETAILS,
            storesSuccessItemDetails: STORE_ITEM_DETAILS,
            pendingEmployeeCount: 0,
            currentCycleAlreadyHandledCount: 0,
            totalEmployees: 0,
            processedEmployees: 0,
            successCount: 0,
            skippedCount: 0,
            failureCount: 0,
            generated: [],
            skipped: [],
            failed: [],
        };
        try {
            result.totalEmployees = await scheduler_repository_1.SchedulerRepository.countActiveEmployees(options.salaryTypes);
            timer.checkpoint("active employee count");
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                status: client_1.SchedulerRunStatus.RUNNING,
                totalEmployees: result.totalEmployees,
                startedAt,
                metadata: {
                    triggeredBy,
                    triggeredByUserId: options.triggeredByUserId,
                    mode: options.mode ?? triggeredBy,
                    salaryTypes: options.salaryTypes,
                    periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
                    startedAt,
                },
            });
            timer.checkpoint("scheduler run initialized");
            const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
            const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
            timer.checkpoint("system setting fetch");
            const currentDate = todayUtc();
            const targetPeriods = new Map((options.salaryTypes?.length
                ? options.salaryTypes
                : [client_1.SalaryType.MONTHLY, client_1.SalaryType.WEEKLY]).map((salaryType) => [
                salaryType,
                getLatestCompletedPeriod(salaryType, currentDate, weekStartsOn),
            ]));
            const targetPeriodList = Array.from(targetPeriods.entries()).map(([salaryType, period]) => ({
                salaryType,
                ...period,
            }));
            const pendingEmployees = await scheduler_repository_1.SchedulerRepository.countPendingActiveEmployees(targetPeriodList);
            result.pendingEmployeeCount = pendingEmployees;
            result.currentCycleAlreadyHandledCount =
                result.totalEmployees - pendingEmployees;
            result.processedEmployees = result.currentCycleAlreadyHandledCount;
            result.skippedCount = result.currentCycleAlreadyHandledCount;
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                processedEmployees: result.processedEmployees,
                skippedCount: result.skippedCount,
            });
            timer.checkpoint("current-cycle pending employee count");
            if (STORE_ITEM_DETAILS &&
                result.currentCycleAlreadyHandledCount > 0) {
                let handledCursor;
                while (true) {
                    const handledEmployees = await scheduler_repository_1.SchedulerRepository.getHandledActiveEmployeesBatch({
                        take: BATCH_SIZE,
                        ...(handledCursor ? { cursor: handledCursor } : {}),
                        targetPeriods: targetPeriodList,
                    });
                    if (handledEmployees.length === 0) {
                        break;
                    }
                    await scheduler_repository_1.SchedulerRepository.createRunItems(handledEmployees.map((employee) => {
                        const period = targetPeriods.get(employee.salaryType);
                        const payroll = employee.payrolls.find((item) => formatDate(item.periodStart) ===
                            formatDate(period.periodStart) &&
                            formatDate(item.periodEnd) === formatDate(period.periodEnd));
                        return {
                            runId: run.id,
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                            status: client_1.SchedulerRunItemStatus.SKIPPED,
                            reason: payroll
                                ? `Current payroll cycle already handled (${payroll.status})`
                                : "Current payroll cycle already handled",
                            payrollId: payroll?.id,
                        };
                    }));
                    handledCursor = handledEmployees[handledEmployees.length - 1]?.id;
                }
                timer.checkpoint("handled employee detail rows stored");
            }
            let cursor;
            while (true) {
                const employees = await scheduler_repository_1.SchedulerRepository.getPendingActiveEmployeesBatch({
                    take: BATCH_SIZE,
                    ...(cursor ? { cursor } : {}),
                    targetPeriods: targetPeriodList,
                });
                timer.checkpoint("employee batch fetch");
                if (employees.length === 0) {
                    break;
                }
                const employeeIds = employees.map((employee) => employee.id);
                const firstSalaryMap = await scheduler_repository_1.SchedulerRepository.getFirstSalaryHistories(employeeIds);
                const schedulerItemsToCreate = [];
                timer.checkpoint("batch preload");
                await processWithConcurrency(employees, EMPLOYEE_CONCURRENCY, async (employee) => {
                    try {
                        const firstSalary = firstSalaryMap.get(employee.id);
                        if (!firstSalary) {
                            result.skippedCount++;
                            addResultItem(result.skipped, {
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                reason: "No salary history found",
                            });
                            schedulerItemsToCreate.push({
                                runId: run.id,
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                status: client_1.SchedulerRunItemStatus.SKIPPED,
                                reason: "No salary history found",
                            });
                            return;
                        }
                        const currentPeriod = targetPeriods.get(employee.salaryType);
                        if (employee.joiningDate > currentPeriod.periodEnd ||
                            firstSalary.effectiveFrom > currentPeriod.periodEnd) {
                            result.skippedCount++;
                            addResultItem(result.skipped, {
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                periodStart: formatDate(currentPeriod.periodStart),
                                periodEnd: formatDate(currentPeriod.periodEnd),
                                reason: "Employee was not eligible in the current payroll cycle",
                            });
                            schedulerItemsToCreate.push({
                                runId: run.id,
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                periodStart: currentPeriod.periodStart,
                                periodEnd: currentPeriod.periodEnd,
                                status: client_1.SchedulerRunItemStatus.SKIPPED,
                                reason: "Employee was not eligible in the current payroll cycle",
                            });
                            return;
                        }
                        const payroll = await payroll_service_1.PayrollService.generate({
                            employeeId: employee.id,
                            periodStart: formatDate(currentPeriod.periodStart),
                            periodEnd: formatDate(currentPeriod.periodEnd),
                            createPayslip: false,
                        }, "SUPER_ADMIN");
                        const payrollResult = payroll;
                        const generatedPayrollId = payrollResult?.payroll?.id ?? payrollResult?.id;
                        if (!generatedPayrollId) {
                            throw new Error("Payroll generation did not return payroll id");
                        }
                        result.successCount++;
                        addResultItem(result.generated, {
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            periodStart: formatDate(currentPeriod.periodStart),
                            periodEnd: formatDate(currentPeriod.periodEnd),
                            payrollId: generatedPayrollId,
                        });
                        if (STORE_ITEM_DETAILS) {
                            schedulerItemsToCreate.push({
                                runId: run.id,
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                periodStart: currentPeriod.periodStart,
                                periodEnd: currentPeriod.periodEnd,
                                status: client_1.SchedulerRunItemStatus.SUCCESS,
                                payrollId: generatedPayrollId,
                            });
                        }
                    }
                    catch (error) {
                        const errorMessage = error instanceof Error ? error.message : "Unknown error";
                        if (/payroll already|active payroll already/i.test(errorMessage)) {
                            result.skippedCount++;
                            addResultItem(result.skipped, {
                                employeeId: employee.id,
                                employeeCode: employee.employeeCode,
                                reason: "Current payroll cycle was already handled",
                            });
                            if (STORE_ITEM_DETAILS) {
                                const period = targetPeriods.get(employee.salaryType);
                                schedulerItemsToCreate.push({
                                    runId: run.id,
                                    employeeId: employee.id,
                                    employeeCode: employee.employeeCode,
                                    periodStart: period.periodStart,
                                    periodEnd: period.periodEnd,
                                    status: client_1.SchedulerRunItemStatus.SKIPPED,
                                    reason: "Current payroll cycle was already handled",
                                });
                            }
                            return;
                        }
                        result.failureCount++;
                        addResultItem(result.failed, {
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            error: errorMessage,
                        });
                        schedulerItemsToCreate.push({
                            runId: run.id,
                            employeeId: employee.id,
                            employeeCode: employee.employeeCode,
                            status: client_1.SchedulerRunItemStatus.FAILED,
                            errorMessage,
                        });
                    }
                    finally {
                        result.processedEmployees++;
                    }
                });
                await scheduler_repository_1.SchedulerRepository.createRunItems(schedulerItemsToCreate);
                await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                    processedEmployees: result.processedEmployees,
                    successCount: result.successCount,
                    skippedCount: result.skippedCount,
                    failedCount: result.failureCount,
                });
                cursor = employees[employees.length - 1]?.id;
                timer.checkpoint("batch processed");
            }
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                completedAt: new Date(),
                status: result.failureCount > 0
                    ? client_1.SchedulerRunStatus.PARTIAL_SUCCESS
                    : client_1.SchedulerRunStatus.COMPLETED,
                processedEmployees: result.processedEmployees,
                successCount: result.successCount,
                skippedCount: result.skippedCount,
                failedCount: result.failureCount,
                metadata: result,
            });
            timer.checkpoint("scheduler run completed");
            timer.end();
            return result;
        }
        catch (error) {
            await scheduler_repository_1.SchedulerRepository.updateRun(run.id, {
                completedAt: new Date(),
                status: client_1.SchedulerRunStatus.FAILED,
                errorMessage: error instanceof Error ? error.message : "Unknown error",
                metadata: result,
            });
            timer.checkpoint("scheduler run failed");
            timer.end();
            throw error;
        }
    }
    static async listRuns(query) {
        await this.recoverStaleRuns();
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
    static async getRunStatus(id) {
        await this.recoverStaleRuns();
        return scheduler_repository_1.SchedulerRepository.findRunById(id);
    }
    static async listRunItems(runId, query) {
        const run = await scheduler_repository_1.SchedulerRepository.findRunById(runId);
        if (!run) {
            return null;
        }
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const status = query.status
            ? String(query.status)
            : undefined;
        const [items, total] = await scheduler_repository_1.SchedulerRepository.listRunItems({
            runId,
            skip,
            take,
            ...(status && { status }),
        });
        const metadata = run.metadata;
        if (status === client_1.SchedulerRunItemStatus.SUCCESS &&
            total === 0 &&
            Array.isArray(metadata?.generated) &&
            metadata.generated.length > 0) {
            const generatedRows = metadata.generated
                .slice(skip, skip + take)
                .map((item, index) => ({
                id: `${runId}-generated-${skip + index}`,
                runId,
                employeeId: item.employeeId,
                employeeCode: item.employeeCode,
                periodStart: item.periodStart,
                periodEnd: item.periodEnd,
                status: client_1.SchedulerRunItemStatus.SUCCESS,
                payrollId: item.payrollId ?? null,
                reason: null,
                errorMessage: null,
                createdAt: run.completedAt ?? run.createdAt,
            }));
            return {
                data: generatedRows,
                pagination: (0, pagination_util_1.buildPaginationMeta)(metadata.generated.length, page, limit),
            };
        }
        return {
            data: items,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.SchedulerService = SchedulerService;
//# sourceMappingURL=scheduler.service.js.map