"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerController = void 0;
const scheduler_service_1 = require("./scheduler.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class SchedulerController {
    static async runPayroll(req, res, next) {
        try {
            const result = await scheduler_service_1.SchedulerService.runPayrollScheduler("MANUAL");
            res.json({
                success: true,
                message: "Payroll scheduler executed successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async runs(req, res, next) {
        try {
            const result = await scheduler_service_1.SchedulerService.listRuns(req.query);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "PAYROLL_GENERATE",
                module: "SCHEDULER",
                newData: {
                    triggeredBy: "MANUAL",
                    result,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Scheduler runs fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SchedulerController = SchedulerController;
//# sourceMappingURL=scheduler.controller.js.map