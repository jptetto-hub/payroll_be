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
}
