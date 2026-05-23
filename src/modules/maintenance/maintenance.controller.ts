import { NextFunction, Request, Response } from "express";
import { MaintenanceService } from "./maintenance.service";
import { PartitionService } from "./partition.service";

export class MaintenanceController {
  static async cleanup(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await MaintenanceService.runCleanup();

      return res.json({
        success: true,
        message: "Maintenance cleanup completed",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async prepareNextMonthPartitions(
    _req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const data = await PartitionService.createNextMonthPartitions();

      return res.json({
        success: true,
        message: "Next month partition preparation completed",
        data,
      });
    } catch (error) {
      return next(error);
    }
  }
}
