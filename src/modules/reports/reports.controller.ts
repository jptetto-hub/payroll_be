import { Request, Response, NextFunction } from "express";
import { ReportsService } from "./reports.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

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

export class ReportsController {
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
