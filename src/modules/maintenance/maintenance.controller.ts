import { NextFunction, Request, Response } from "express";
import { MaintenanceService } from "./maintenance.service";
import { PartitionService } from "./partition.service";
import { CloudBackupService } from "./cloud-backup.service";
import { SystemRestartService } from "./system-restart.service";

export class MaintenanceController {
  static async restartStatus(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SystemRestartService.getStatus();
      res.set("Cache-Control", "no-store");
      return res.json({ success: true, message: "Service restart status fetched", data });
    } catch (error) {
      return next(error);
    }
  }

  static async restartServices(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SystemRestartService.startRestart(req.body.confirmation);
      return res.status(202).json({ success: true, message: "Service restart started", data });
    } catch (error) {
      return next(error);
    }
  }

  static async dismissRestart(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SystemRestartService.dismiss();
      return res.json({ success: true, message: "Restart notification dismissed", data });
    } catch (error) {
      return next(error);
    }
  }

  static async listBackups(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CloudBackupService.listBackups();
      return res.json({ success: true, message: "R2 backups fetched", data });
    } catch (error) {
      return next(error);
    }
  }

  static async createBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CloudBackupService.startBackup(req.body.backupType);
      return res.status(202).json({ success: true, message: "R2 backup started", data });
    } catch (error) {
      return next(error);
    }
  }

  static async getBackupOperation(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CloudBackupService.getOperation(String(req.params.id));
      return res.json({ success: true, message: "Backup operation fetched", data });
    } catch (error) {
      return next(error);
    }
  }

  static async restoreBackup(req: Request, res: Response, next: NextFunction) {
    try {
      const data = CloudBackupService.startRestore(req.body.objectKey, req.body.confirmation);
      return res.status(202).json({ success: true, message: "R2 restore started", data });
    } catch (error) {
      return next(error);
    }
  }

  static async cleanupBackups(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CloudBackupService.cleanupExpired({
        confirmation: req.body.confirmation,
        dryRun: req.body.dryRun !== false,
      });
      return res.json({ success: true, message: data.dryRun ? "R2 cleanup preview completed" : "Expired R2 backups deleted", data });
    } catch (error) {
      return next(error);
    }
  }

  static async clearDatabase(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CloudBackupService.clearDatabase(req.body.confirmation);
      return res.json({ success: true, message: "Database records cleared", data });
    } catch (error) {
      return next(error);
    }
  }

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
