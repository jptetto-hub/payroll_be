"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRequestController = void 0;
const attendance_request_service_1 = require("./attendance-request.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class AttendanceRequestController {
    static async create(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.createRequest(req.body, req.user);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "ATTENDANCE_REQUEST",
                newData: result,
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.status(201).json({
                success: true,
                message: "Attendance request created successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async myRequests(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.myRequests(req.user.id, req.query);
            res.json({
                success: true,
                message: "My attendance requests fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async pendingRequests(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.pendingRequests(req.query, req.user);
            res.json({
                success: true,
                message: "Pending attendance requests fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async decision(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.decisionRequests(req.body, req.user.id);
            res.json({
                success: true,
                message: req.body.action === "APPROVE"
                    ? "Attendance request(s) approved successfully"
                    : "Attendance request(s) rejected successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async approve(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.approveRequest(req.params.id, req.user.id);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "APPROVE",
                module: "ATTENDANCE_REQUEST",
                newData: result,
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Attendance request approved successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async reject(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.rejectRequest(req.params.id, req.user.id, req.body.rejectionReason);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "REJECT",
                module: "ATTENDANCE_REQUEST",
                newData: {
                    request: result,
                    rejectionReason: req.body.rejectionReason,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Attendance request rejected successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteOwn(req, res, next) {
        try {
            const result = await attendance_request_service_1.AttendanceRequestService.deleteOwnRequest(req.params.id, req.user);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "DELETE",
                module: "ATTENDANCE_REQUEST",
                newData: {
                    deletedRequest: result,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Attendance request deleted successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AttendanceRequestController = AttendanceRequestController;
//# sourceMappingURL=attendance-request.controller.js.map