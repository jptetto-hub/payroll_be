import { Request, Response, NextFunction } from "express";
import { AttendanceRequestService } from "./attendance-request.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

type AttendanceRequestParams = {
  id: string;
};

export class AttendanceRequestController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceRequestService.createRequest(
        req.body,
        req.user,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async myRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceRequestService.myRequests(
        req.user.id,
        req.query as any,
      );

      res.json({
        success: true,
        message: "My attendance requests fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async pendingRequests(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceRequestService.pendingRequests(
        req.query as any,
        req.user,
      );

      res.json({
        success: true,
        message: "Pending attendance requests fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async decision(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AttendanceRequestService.decisionRequests(
        req.body,
        req.user.id,
      );

      res.json({
        success: true,
        message:
          req.body.action === "APPROVE"
            ? "Attendance request(s) approved successfully"
            : "Attendance request(s) rejected successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async approve(
    req: Request<AttendanceRequestParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceRequestService.approveRequest(
        req.params.id,
        req.user.id,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async reject(
    req: Request<AttendanceRequestParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceRequestService.rejectRequest(
        req.params.id,
        req.user.id,
        req.body.rejectionReason,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async deleteOwn(
    req: Request<AttendanceRequestParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await AttendanceRequestService.deleteOwnRequest(
        req.params.id,
        req.user,
      );
      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }
}
