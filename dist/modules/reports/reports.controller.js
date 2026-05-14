"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("./reports.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const auditReportExport = async (req, reportType, exportType) => {
    await audit_log_service_1.AuditLogService.create({
        userId: req.user.id,
        action: "EXPORT",
        module: "REPORTS",
        oldData: null,
        newData: {
            reportType,
            exportType,
            filters: req.query,
        },
        ipAddress: req.ip,
    });
};
class ReportsController {
    static async salary(req, res, next) {
        try {
            const result = await reports_service_1.ReportsService.salary(req.query, req.user);
            res.json({
                success: true,
                message: "Salary report fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (e) {
            next(e);
        }
    }
    static async salaryExport(req, res, next) {
        try {
            const csv = await reports_service_1.ReportsService.salaryExport(req.query, req.user);
            await auditReportExport(req, "SALARY", "CSV");
            res.header("Content-Type", "text/csv");
            res.attachment("salary-report.csv");
            res.send(csv);
        }
        catch (e) {
            next(e);
        }
    }
    static async attendance(req, res, next) {
        try {
            const result = await reports_service_1.ReportsService.attendance(req.query, req.user);
            res.json({
                success: true,
                message: "Attendance report fetched successfully",
                data: result.data,
                summary: result.summary,
                pagination: result.pagination,
            });
        }
        catch (e) {
            next(e);
        }
    }
    static async attendanceExport(req, res, next) {
        try {
            const csv = await reports_service_1.ReportsService.attendanceExport(req.query, req.user);
            await auditReportExport(req, "ATTENDANCE", "CSV");
            res.header("Content-Type", "text/csv");
            res.attachment("attendance-report.csv");
            res.send(csv);
        }
        catch (e) {
            next(e);
        }
    }
    static async advance(req, res, next) {
        try {
            const result = await reports_service_1.ReportsService.advance(req.query, req.user);
            res.json({
                success: true,
                message: "Advance report fetched successfully",
                data: result.data,
                summary: result.summary,
                pagination: result.pagination,
            });
        }
        catch (e) {
            next(e);
        }
    }
    static async advanceExport(req, res, next) {
        try {
            const csv = await reports_service_1.ReportsService.advanceExport(req.query, req.user);
            await auditReportExport(req, "ADVANCE", "CSV");
            res.header("Content-Type", "text/csv");
            res.attachment("advance-report.csv");
            res.send(csv);
        }
        catch (e) {
            next(e);
        }
    }
    static async salaryExportExcel(req, res, next) {
        try {
            const buffer = await reports_service_1.ReportsService.salaryExportExcel(req.query, req.user);
            await auditReportExport(req, "SALARY", "EXCEL");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=salary-report.xlsx");
            res.send(buffer);
        }
        catch (e) {
            next(e);
        }
    }
    static async attendanceExportExcel(req, res, next) {
        try {
            const buffer = await reports_service_1.ReportsService.attendanceExportExcel(req.query, req.user);
            await auditReportExport(req, "ATTENDANCE", "EXCEL");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=attendance-report.xlsx");
            res.send(buffer);
        }
        catch (e) {
            next(e);
        }
    }
    static async advanceExportExcel(req, res, next) {
        try {
            const buffer = await reports_service_1.ReportsService.advanceExportExcel(req.query, req.user);
            await auditReportExport(req, "ADVANCE", "EXCEL");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=advance-report.xlsx");
            res.send(buffer);
        }
        catch (e) {
            next(e);
        }
    }
    static async allInOne(req, res, next) {
        try {
            const result = await reports_service_1.ReportsService.allInOne(req.query, req.user);
            res.json({
                success: true,
                message: "All-in-one report fetched successfully",
                data: result.data,
                summary: result.summary,
                pagination: result.pagination,
            });
        }
        catch (e) {
            next(e);
        }
    }
    static async allInOneExport(req, res, next) {
        try {
            const csv = await reports_service_1.ReportsService.allInOneExport(req.query, req.user);
            await auditReportExport(req, "ALL_IN_ONE", "CSV");
            res.header("Content-Type", "text/csv");
            res.attachment("all-in-one-report.csv");
            res.send(csv);
        }
        catch (e) {
            next(e);
        }
    }
    static async allInOneExportExcel(req, res, next) {
        try {
            const buffer = await reports_service_1.ReportsService.allInOneExportExcel(req.query, req.user);
            await auditReportExport(req, "ALL_IN_ONE", "EXCEL");
            res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
            res.setHeader("Content-Disposition", "attachment; filename=all-in-one-report.xlsx");
            res.send(buffer);
        }
        catch (e) {
            next(e);
        }
    }
}
exports.ReportsController = ReportsController;
//# sourceMappingURL=reports.controller.js.map