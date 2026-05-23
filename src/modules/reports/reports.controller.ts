import { Request, Response, NextFunction } from "express";
import { ReportsService } from "./reports.service";
import { ReportsRepository } from "./reports.repository";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { getCursorPagination } from "../../shared/utils/cursor-pagination.util";
import { AppError } from "../../shared/utils/app-error";
import { parseRequiredDateRange } from "../../utils/reportValidation";
import { serializeBigInt } from "../../utils/serializeBigInt";
import { withTimeout } from "../../utils/timeout";

const auditReportExport = async (
  req: Request,
  reportType: string,
  exportType: "CSV" | "EXCEL",
) => {
  await AuditLogService.create({
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

const parseSalaryType = (value: unknown) => {
  if (value === undefined) {
    return undefined;
  }

  const salaryType = String(value);

  if (salaryType !== "MONTHLY" && salaryType !== "WEEKLY") {
    throw new AppError("salaryType must be MONTHLY or WEEKLY", 400);
  }

  return salaryType;
};

export class ReportsController {
  static async payrollSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { from, to } = parseRequiredDateRange(
        req.query,
        REPORT_MAX_RANGE_DAYS,
      );
      const salaryType = parseSalaryType(req.query.salaryType);
      const report = await withTimeout(
        ReportsRepository.getPayrollSummaryReport({
          from,
          to,
          ...(salaryType && { salaryType }),
          ...(req.query.employeeId && {
            employeeId: String(req.query.employeeId),
          }),
        }),
        REPORT_TIMEOUT_MS,
        "Report generation timed out. Please reduce date range.",
      );

      return res.json({
        success: true,
        data: serializeBigInt(report),
      });
    } catch (e) {
      return next(e);
    }
  }

  static async employeePayroll(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { from, to } = parseRequiredDateRange(
        req.query,
        REPORT_MAX_RANGE_DAYS,
      );
      const { limit, cursor } = getCursorPagination(req.query);
      const rows = await withTimeout(
        ReportsRepository.getEmployeePayrollReport({
          from,
          to,
          limit,
          ...(cursor && { cursor }),
          ...(req.query.employeeId && {
            employeeId: String(req.query.employeeId),
          }),
        }),
        REPORT_TIMEOUT_MS,
        "Report generation timed out. Please reduce date range.",
      );
      const hasNextPage = rows.length > limit;
      const data = hasNextPage ? rows.slice(0, limit) : rows;
      const nextCursor = hasNextPage
        ? data[data.length - 1]?.employeeId ?? null
        : null;

      return res.json({
        success: true,
        data: serializeBigInt(data),
        pagination: {
          limit,
          nextCursor,
          hasNextPage,
        },
      });
    } catch (e) {
      return next(e);
    }
  }

  static async ledgerSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { from, to } = parseRequiredDateRange(
        req.query,
        REPORT_MAX_RANGE_DAYS,
      );
      const report = await withTimeout(
        ReportsRepository.getLedgerSummaryReport({
          from,
          to,
          ...(req.query.employeeId && {
            employeeId: String(req.query.employeeId),
          }),
        }),
        REPORT_TIMEOUT_MS,
        "Report generation timed out. Please reduce date range.",
      );

      return res.json({
        success: true,
        data: serializeBigInt(report),
      });
    } catch (e) {
      return next(e);
    }
  }

  static async attendanceSummaryRaw(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { from, to } = parseRequiredDateRange(
        req.query,
        REPORT_MAX_RANGE_DAYS,
      );
      const report = await withTimeout(
        ReportsRepository.getAttendanceSummaryReport({
          from,
          to,
          ...(req.query.employeeId && {
            employeeId: String(req.query.employeeId),
          }),
        }),
        REPORT_TIMEOUT_MS,
        "Report generation timed out. Please reduce date range.",
      );

      return res.json({
        success: true,
        data: serializeBigInt(report),
      });
    } catch (e) {
      return next(e);
    }
  }

  static async advanceOutstanding(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const salaryType = parseSalaryType(req.query.salaryType);
      const report = await withTimeout(
        ReportsRepository.getAdvanceOutstandingReport({
          ...(salaryType && { salaryType }),
          ...(req.query.employeeId && {
            employeeId: String(req.query.employeeId),
          }),
        }),
        REPORT_TIMEOUT_MS,
        "Report generation timed out. Please reduce filters.",
      );

      return res.json({
        success: true,
        data: serializeBigInt(report),
      });
    } catch (e) {
      return next(e);
    }
  }

  static async salary(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.salary(req.query, req.user);

      res.json({
        success: true,
        message: "Salary report fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (e) {
      next(e);
    }
  }

  static async salaryExport(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportsService.salaryExport(req.query, req.user);
      await auditReportExport(req, "SALARY", "CSV");

      res.header("Content-Type", "text/csv");
      res.attachment("salary-report.csv");
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }

  static async attendance(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.attendance(req.query, req.user);

      res.json({
        success: true,
        message: "Attendance report fetched successfully",
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (e) {
      next(e);
    }
  }

  static async attendanceExport(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const csv = await ReportsService.attendanceExport(req.query, req.user);
      await auditReportExport(req, "ATTENDANCE", "CSV");

      res.header("Content-Type", "text/csv");
      res.attachment("attendance-report.csv");
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }

  static async advance(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.advance(req.query, req.user);

      res.json({
        success: true,
        message: "Advance report fetched successfully",
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (e) {
      next(e);
    }
  }

  static async advanceExport(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportsService.advanceExport(req.query, req.user);
      await auditReportExport(req, "ADVANCE", "CSV");

      res.header("Content-Type", "text/csv");
      res.attachment("advance-report.csv");
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }

  static async salaryExportExcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const buffer = await ReportsService.salaryExportExcel(
        req.query,
        req.user,
      );
      await auditReportExport(req, "SALARY", "EXCEL");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=salary-report.xlsx",
      );

      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  static async attendanceExportExcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const buffer = await ReportsService.attendanceExportExcel(
        req.query,
        req.user,
      );
      await auditReportExport(req, "ATTENDANCE", "EXCEL");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=attendance-report.xlsx",
      );

      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  static async advanceExportExcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const buffer = await ReportsService.advanceExportExcel(
        req.query,
        req.user,
      );
      await auditReportExport(req, "ADVANCE", "EXCEL");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=advance-report.xlsx",
      );

      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }

  static async allInOne(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReportsService.allInOne(req.query, req.user);
      res.json({
        success: true,
        message: "All-in-one report fetched successfully",
        data: result.data,
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (e) {
      next(e);
    }
  }

  static async allInOneExport(req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await ReportsService.allInOneExport(req.query, req.user);
      await auditReportExport(req, "ALL_IN_ONE", "CSV");

      res.header("Content-Type", "text/csv");
      res.attachment("all-in-one-report.csv");
      res.send(csv);
    } catch (e) {
      next(e);
    }
  }

  static async allInOneExportExcel(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const buffer = await ReportsService.allInOneExportExcel(
        req.query,
        req.user,
      );
      await auditReportExport(req, "ALL_IN_ONE", "EXCEL");

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=all-in-one-report.xlsx",
      );

      res.send(buffer);
    } catch (e) {
      next(e);
    }
  }
}
