"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPayrollCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const scheduler_repository_1 = require("../modules/scheduler/scheduler.repository");
const scheduler_service_1 = require("../modules/scheduler/scheduler.service");
const payrollScheduler_queue_1 = require("../jobs/payrollScheduler.queue");
const logger_1 = require("../config/logger");
const timezone_1 = require("../config/timezone");
const DAILY_CATCH_UP_CRON_EXPRESSION = process.env.PAYROLL_CRON_CATCH_UP_EXPRESSION || "5 0 * * *";
const MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION = process.env.PAYROLL_MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION || "59 11 * * *";
function getDueSalaryTypes(date, timezone) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        weekday: "short",
        year: "numeric",
        month: "numeric",
        day: "numeric",
    }).formatToParts(date);
    const read = (type) => parts.find((part) => part.type === type)?.value ?? "";
    const weekday = read("weekday");
    const year = Number(read("year"));
    const month = Number(read("month"));
    const day = Number(read("day"));
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const salaryTypes = [];
    if (weekday === "Sat") {
        salaryTypes.push(client_1.SalaryType.WEEKLY);
    }
    if (day === lastDayOfMonth) {
        salaryTypes.push(client_1.SalaryType.MONTHLY);
    }
    return salaryTypes;
}
async function enqueuePayrollIfPending(params) {
    const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
    if (setting && !setting.autoPayrollEnabled) {
        logger_1.logger.info({ salaryTypes: params.salaryTypes, reason: params.reason }, "Payroll cron skipped: autoPayrollEnabled is false");
        return;
    }
    await scheduler_service_1.SchedulerService.recoverStaleRuns();
    const existingManualRun = await scheduler_repository_1.SchedulerRepository.findActiveRunByName("MANUAL_PAYROLL_SCHEDULER");
    const existingCronRun = await scheduler_repository_1.SchedulerRepository.findActiveRunByName("CRON_PAYROLL_SCHEDULER");
    if (existingManualRun || existingCronRun) {
        logger_1.logger.warn({
            existingManualRun,
            existingCronRun,
            salaryTypes: params.salaryTypes,
            reason: params.reason,
        }, "Payroll cron skipped because scheduler is already running");
        return;
    }
    const pendingPayrollCount = await scheduler_service_1.SchedulerService.countPendingCurrentCyclePayrolls(params.salaryTypes);
    if (pendingPayrollCount === 0) {
        logger_1.logger.info({ salaryTypes: params.salaryTypes, reason: params.reason }, "Payroll cron skipped: all current payroll cycles are already handled");
        return;
    }
    const salaryTypes = params.salaryTypes ?? [
        client_1.SalaryType.MONTHLY,
        client_1.SalaryType.WEEKLY,
    ];
    const run = await scheduler_repository_1.SchedulerRepository.createRun({
        name: "CRON_PAYROLL_SCHEDULER",
        status: client_1.SchedulerRunStatus.PENDING,
        metadata: {
            triggeredBy: "CRON",
            triggeredAt: new Date().toISOString(),
            mode: "BACKGROUND",
            reason: params.reason,
            salaryTypes,
            periodPolicy: "LATEST_COMPLETED_CYCLE_ONLY",
        },
    });
    await payrollScheduler_queue_1.payrollSchedulerQueue.add("manual-payroll-run", {
        runId: run.id,
        triggeredBy: undefined,
        triggeredByType: "CRON",
        salaryTypes,
    }, {
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
    });
    logger_1.logger.info({ runId: run.id, salaryTypes, pendingPayrollCount, reason: params.reason }, "Payroll cron job queued");
}
const startPayrollCron = async () => {
    const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
    const cronTimezone = (0, timezone_1.getConfiguredTimezone)(process.env.PAYROLL_CRON_TIMEZONE || setting?.organizationTimezone);
    node_cron_1.default.schedule(MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION, async () => {
        try {
            const salaryTypes = getDueSalaryTypes(new Date(), cronTimezone);
            if (salaryTypes.length === 0) {
                return;
            }
            const reminder = await scheduler_service_1.SchedulerService.getManualAdvanceDeductionReminders(salaryTypes);
            if (reminder.count > 0) {
                logger_1.logger.warn({
                    count: reminder.count,
                    items: reminder.items,
                    salaryTypes,
                }, "Manual advance deduction reminder: amounts missing before payroll cron");
            }
            else {
                logger_1.logger.info({ salaryTypes }, "Manual advance deduction reminder checked: no missing amounts");
            }
        }
        catch (error) {
            logger_1.logger.error({ error }, "Manual advance deduction reminder cron failed");
        }
    }, {
        timezone: cronTimezone,
    });
    node_cron_1.default.schedule("59 23 * * *", async () => {
        try {
            const salaryTypes = getDueSalaryTypes(new Date(), cronTimezone);
            if (salaryTypes.length === 0) {
                return;
            }
            await enqueuePayrollIfPending({
                salaryTypes,
                reason: "CRON_DUE_TIME",
            });
        }
        catch (error) {
            logger_1.logger.error({ error }, "Payroll cron failed to enqueue job");
        }
    }, {
        timezone: cronTimezone,
    });
    node_cron_1.default.schedule(DAILY_CATCH_UP_CRON_EXPRESSION, async () => {
        try {
            await enqueuePayrollIfPending({ reason: "DAILY_CATCH_UP" });
        }
        catch (error) {
            logger_1.logger.error({ error }, "Payroll cron catch-up failed to enqueue job");
        }
    }, {
        timezone: cronTimezone,
    });
    logger_1.logger.info({
        timezone: cronTimezone,
        dueExpression: "59 23 * * *",
        manualAdvanceReminderExpression: MANUAL_ADVANCE_REMINDER_CRON_EXPRESSION,
        catchUpExpression: DAILY_CATCH_UP_CRON_EXPRESSION,
    }, "Payroll cron scheduled");
    if (process.env.PAYROLL_CRON_RUN_ON_STARTUP !== "false") {
        void enqueuePayrollIfPending({ reason: "STARTUP_CATCH_UP" }).catch((error) => {
            logger_1.logger.error({ error }, "Payroll startup catch-up failed");
        });
    }
};
exports.startPayrollCron = startPayrollCron;
//# sourceMappingURL=payroll.cron.js.map