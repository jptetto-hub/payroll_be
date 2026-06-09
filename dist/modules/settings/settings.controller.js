"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsController = void 0;
const settings_service_1 = require("./settings.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class SettingsController {
    static async getMyPermissions(req, res, next) {
        try {
            const permissions = await settings_service_1.SettingsService.getRolePermissions();
            res.json({
                success: true,
                message: "Role permissions fetched successfully",
                data: req.user.role === "SUPER_ADMIN"
                    ? Object.fromEntries(Object.keys(permissions.ADMIN).map((key) => [key, true]))
                    : permissions[req.user.role],
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getRolePermissions(_req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.getRolePermissions();
            res.json({
                success: true,
                message: "Role permissions fetched successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateRolePermissions(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.updateRolePermissions(req.body);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "ROLE_PERMISSIONS",
                newData: result,
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Role permissions updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
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
    static async updateTimezone(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.updateSettings({
                organizationTimezone: req.body.organizationTimezone,
            });
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "SETTINGS",
                newData: { organizationTimezone: result.organizationTimezone },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Organization timezone updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listWorkHourSettings(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.listWorkHourSettings(req.query);
            res.json({
                success: true,
                message: "Work-hour settings fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createWorkHourSetting(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.createWorkHourSetting(req.body, req.user?.id);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "WORK_HOUR_SETTINGS",
                newData: result,
                ipAddress: req.ip,
            });
            res.status(201).json({
                success: true,
                message: "Work-hour setting created successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateWorkHourSetting(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.updateWorkHourSetting(String(req.params.id), req.body);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "WORK_HOUR_SETTINGS",
                newData: result,
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Work-hour setting updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteWorkHourSetting(req, res, next) {
        try {
            const result = await settings_service_1.SettingsService.deleteWorkHourSetting(String(req.params.id));
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "WORK_HOUR_SETTINGS",
                newData: result,
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Work-hour setting deactivated successfully",
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