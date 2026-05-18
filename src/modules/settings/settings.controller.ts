import { Request, Response, NextFunction } from "express";
import { SettingsService } from "./settings.service";
import { AuditLogService } from "../audit-logs/audit-log.service";

export class SettingsController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SettingsService.getSettings();

      res.json({
        success: true,
        message: "Settings fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SettingsService.updateSettings(req.body);

      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async listWorkHourSettings(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SettingsService.listWorkHourSettings(req.query);

      res.json({
        success: true,
        message: "Work-hour settings fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async createWorkHourSetting(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SettingsService.createWorkHourSetting(
        req.body,
        req.user?.id,
      );

      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async updateWorkHourSetting(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SettingsService.updateWorkHourSetting(
        String(req.params.id),
        req.body,
      );

      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }

  static async deleteWorkHourSetting(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await SettingsService.deleteWorkHourSetting(
        String(req.params.id),
      );

      await AuditLogService.log({
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
    } catch (error) {
      next(error);
    }
  }
}
