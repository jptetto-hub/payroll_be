"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPayrollCron = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const scheduler_service_1 = require("../modules/scheduler/scheduler.service");
const scheduler_repository_1 = require("../modules/scheduler/scheduler.repository");
const startPayrollCron = async () => {
    const setting = await scheduler_repository_1.SchedulerRepository.getSystemSetting();
    if (setting && !setting.autoPayrollEnabled) {
        console.log("Payroll scheduler skipped: autoPayrollEnabled is false");
        return;
    }
    node_cron_1.default.schedule("0 1 * * *", async () => {
        try {
            console.log("Payroll scheduler started");
            const result = await scheduler_service_1.SchedulerService.runPayrollScheduler("CRON");
            console.log("Payroll scheduler completed", {
                generated: result.successCount,
                skipped: result.skippedCount,
                failed: result.failureCount,
            });
        }
        catch (error) {
            console.error("Payroll scheduler failed", error);
        }
    });
};
exports.startPayrollCron = startPayrollCron;
//# sourceMappingURL=payroll.cron.js.map