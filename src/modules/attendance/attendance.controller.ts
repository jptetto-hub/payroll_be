import { Request, Response, NextFunction } from "express";
import { AttendanceService } from "./attendance.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type AttendanceParams = {
  id: string;
};

type EmployeeParams = {
  employeeId: string;
};

type RangeQuery = {
  from: string;
  to: string;
};

export class AttendanceController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.list(req.query, req.user.role);

      res.json({
        success: true,
        message: "Attendance list fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.createAttendance(
        req.body,
        req.user.role,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async bulk(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.bulkAttendance(
        req.body.records,
        req.user.role,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async listByEmployee(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceService.listByEmployee(
        req.params.employeeId,
        req.user.role,
        req.user.id,
        req.query,
      );

      res.json({
        success: true,
        message: "Attendance fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listByRange(
    req: Request<EmployeeParams, unknown, unknown, RangeQuery>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceService.listByRange(
        req.params.employeeId,
        req.query.from,
        req.query.to,
        req.user,
        req.query,
      );

      res.json({
        success: true,
        message: "Attendance range fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(
    req: Request<AttendanceParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceService.updateAttendance(
        req.params.id,
        req.body.status,
        req.user.role,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request<AttendanceParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceService.deleteAttendance(
        req.params.id,
        req.user.role,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async bulkUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.bulkUpdateAttendance(
        req.body.records,
        req.user.role,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async bulkDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceService.bulkDeleteAttendance(
        req.body.attendanceIds,
        req.user.role,
        req.body.reason,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }
}
