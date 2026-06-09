"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsController = void 0;
const reports_service_1 = require("./reports.service");
const reports_repository_1 = require("./reports.repository");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const cursor_pagination_util_1 = require("../../shared/utils/cursor-pagination.util");
const app_error_1 = require("../../shared/utils/app-error");
const reportValidation_1 = require("../../utils/reportValidation");
const serializeBigInt_1 = require("../../utils/serializeBigInt");
const timeout_1 = require("../../utils/timeout");
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
const REPORT_MAX_RANGE_DAYS = Number(process.env.REPORT_MAX_RANGE_DAYS || 31);
const REPORT_TIMEOUT_MS = Number(process.env.REPORT_TIMEOUT_MS || 10000);
const parseSalaryType = (value) => {
    if (value === undefined) {
        return undefined;
    }
    const salaryType = String(value);
    if (salaryType !== "MONTHLY" && salaryType !== "WEEKLY") {
        throw new app_error_1.AppError("salaryType must be MONTHLY or WEEKLY", 400);
    }
    return salaryType;
};
class ReportsController {
    static async payrollSummary(req, res, next) {
        try {
            const { from, to } = (0, reportValidation_1.parseRequiredDateRange)(req.query, REPORT_MAX_RANGE_DAYS);
            const salaryType = parseSalaryType(req.query.salaryType);
            const report = await (0, timeout_1.withTimeout)(reports_repository_1.ReportsRepository.getPayrollSummaryReport({
                from,
                to,
                ...(salaryType && { salaryType }),
                ...(req.query.employeeId && {
                    employeeId: String(req.query.employeeId),
                }),
            }), REPORT_TIMEOUT_MS, "Report generation timed out. Please reduce date range.");
            return res.json({
                success: true,
                data: (0, serializeBigInt_1.serializeBigInt)(report),
            });
        }
        catch (e) {
            return next(e);
        }
    }
    static async employeePayroll(req, res, next) {
        try {
            const { from, to } = (0, reportValidation_1.parseRequiredDateRange)(req.query, REPORT_MAX_RANGE_DAYS);
            const { limit, cursor } = (0, cursor_pagination_util_1.getCursorPagination)(req.query);
            const rows = await (0, timeout_1.withTimeout)(reports_repository_1.ReportsRepository.getEmployeePayrollReport({
                from,
                to,
                limit,
                ...(cursor && { cursor }),
                ...(req.query.employeeId && {
                    employeeId: String(req.query.employeeId),
                }),
            }), REPORT_TIMEOUT_MS, "Report generation timed out. Please reduce date range.");
            const hasNextPage = rows.length > limit;
            const data = hasNextPage ? rows.slice(0, limit) : rows;
            const nextCursor = hasNextPage
                ? data[data.length - 1]?.employeeId ?? null
                : null;
            return res.json({
                success: true,
                data: (0, serializeBigInt_1.serializeBigInt)(data),
                pagination: {
                    limit,
                    nextCursor,
                    hasNextPage,
                },
            });
        }
        catch (e) {
            return next(e);
        }
    }
    static async ledgerSummary(req, res, next) {
        try {
            const { from, to } = (0, reportValidation_1.parseRequiredDateRange)(req.query, REPORT_MAX_RANGE_DAYS);
            const report = await (0, timeout_1.withTimeout)(reports_repository_1.ReportsRepository.getLedgerSummaryReport({
                from,
                to,
                ...(req.query.employeeId && {
                    employeeId: String(req.query.employeeId),
                }),
            }), REPORT_TIMEOUT_MS, "Report generation timed out. Please reduce date range.");
            return res.json({
                success: true,
                data: (0, serializeBigInt_1.serializeBigInt)(report),
            });
        }
        catch (e) {
            return next(e);
        }
    }
    static async attendanceSummaryRaw(req, res, next) {
        try {
            const { from, to } = (0, reportValidation_1.parseRequiredDateRange)(req.query, REPORT_MAX_RANGE_DAYS);
            const report = await (0, timeout_1.withTimeout)(reports_repository_1.ReportsRepository.getAttendanceSummaryReport({
                from,
                to,
                ...(req.query.employeeId && {
                    employeeId: String(req.query.employeeId),
                }),
            }), REPORT_TIMEOUT_MS, "Report generation timed out. Please reduce date range.");
            return res.json({
                success: true,
                data: (0, serializeBigInt_1.serializeBigInt)(report),
            });
        }
        catch (e) {
            return next(e);
        }
    }
    static async advanceOutstanding(req, res, next) {
        try {
            const salaryType = parseSalaryType(req.query.salaryType);
            const report = await (0, timeout_1.withTimeout)(reports_repository_1.ReportsRepository.getAdvanceOutstandingReport({
                ...(salaryType && { salaryType }),
                ...(req.query.employeeId && {
                    employeeId: String(req.query.employeeId),
                }),
            }), REPORT_TIMEOUT_MS, "Report generation timed out. Please reduce filters.");
            return res.json({
                success: true,
                data: (0, serializeBigInt_1.serializeBigInt)(report),
            });
        }
        catch (e) {
            return next(e);
        }
    }
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