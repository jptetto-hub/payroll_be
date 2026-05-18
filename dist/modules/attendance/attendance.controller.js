"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceController = void 0;
const attendance_service_1 = require("./attendance.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class AttendanceController {
    static async list(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.list(req.query, req.user.role);
            res.json({
                success: true,
                message: "Attendance list fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.createAttendance(req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "ATTENDANCE",
                newData: result,
                ipAddress: req.ip,
            });
            res.status(201).json({
                success: true,
                message: "Attendance added successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async bulk(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.bulkAttendance(req.body.records, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "ATTENDANCE_BULK",
                newData: {
                    count: result.createdCount,
                    records: result.records,
                    skippedCount: result.skippedCount,
                    conflicts: result.conflicts,
                },
                ipAddress: req.ip,
            });
            res.status(201).json({
                success: true,
                message: result.conflictMessage
                    ? "Bulk attendance partially processed"
                    : "Bulk attendance processed successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByEmployee(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.listByEmployee(req.params.employeeId, req.user.role, req.user.id, req.query);
            res.json({
                success: true,
                message: "Attendance fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listByRange(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.listByRange(req.params.employeeId, req.query.from, req.query.to, req.user, req.query);
            res.json({
                success: true,
                message: "Attendance range fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.updateAttendance(req.params.id, req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "ATTENDANCE",
                newData: {
                    attendance: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Attendance updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async delete(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.deleteAttendance(req.params.id, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "ATTENDANCE",
                newData: {
                    deletedRecord: result,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Attendance deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async bulkUpdate(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.bulkUpdateAttendance(req.body.records, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "ATTENDANCE_BULK",
                newData: {
                    count: result.length,
                    records: result,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Bulk attendance updated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async bulkDelete(req, res, next) {
        try {
            const result = await attendance_service_1.AttendanceService.bulkDeleteAttendance(req.body.attendanceIds, req.user.role, req.body.reason);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "ATTENDANCE_BULK",
                newData: {
                    count: result.length,
                    deletedRecords: result,
                    reason: req.body.reason,
                },
                ipAddress: req.ip,
            });
            res.json({
                success: true,
                message: "Bulk attendance deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AttendanceController = AttendanceController;
//# sourceMappingURL=attendance.controller.js.map