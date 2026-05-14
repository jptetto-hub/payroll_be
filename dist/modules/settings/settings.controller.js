"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const settings_service_1 = require("./settings.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class SettingsController {
    static async get(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.getSettings();
            res.json({
                success: true,
                message: "Settings fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.updateSettings(req.body);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "SETTINGS",
                newData: result,
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Settings updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SettingsController = SettingsController;
//# sourceMappingURL=settings.controller.js.map