"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaintenanceController = void 0;
const maintenance_service_1 = require("./maintenance.service");
const partition_service_1 = require("./partition.service");
const cloud_backup_service_1 = require("./cloud-backup.service");
const system_restart_service_1 = require("./system-restart.service");
class MaintenanceController {
    static async restartStatus(_req, res, next) {
        try {
            const data = await system_restart_service_1.SystemRestartService.getStatus();
            res.set("Cache-Control", "no-store");
            return res.json({ success: true, message: "Service restart status fetched", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async restartServices(req, res, next) {
        try {
            const data = await system_restart_service_1.SystemRestartService.startRestart(req.body.confirmation);
            return res.status(202).json({ success: true, message: "Service restart started", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async dismissRestart(_req, res, next) {
        try {
            const data = await system_restart_service_1.SystemRestartService.dismiss();
            return res.json({ success: true, message: "Restart notification dismissed", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async listBackups(_req, res, next) {
        try {
            const data = await cloud_backup_service_1.CloudBackupService.listBackups();
            return res.json({ success: true, message: "R2 backups fetched", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async createBackup(req, res, next) {
        try {
            const data = cloud_backup_service_1.CloudBackupService.startBackup(req.body.backupType);
            return res.status(202).json({ success: true, message: "R2 backup started", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async getBackupOperation(req, res, next) {
        try {
            const data = cloud_backup_service_1.CloudBackupService.getOperation(String(req.params.id));
            return res.json({ success: true, message: "Backup operation fetched", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async restoreBackup(req, res, next) {
        try {
            const data = cloud_backup_service_1.CloudBackupService.startRestore(req.body.objectKey, req.body.confirmation);
            return res.status(202).json({ success: true, message: "R2 restore started", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async cleanupBackups(req, res, next) {
        try {
            const data = await cloud_backup_service_1.CloudBackupService.cleanupExpired({
                confirmation: req.body.confirmation,
                dryRun: req.body.dryRun !== false,
            });
            return res.json({ success: true, message: data.dryRun ? "R2 cleanup preview completed" : "Expired R2 backups deleted", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async clearDatabase(req, res, next) {
        try {
            const data = await cloud_backup_service_1.CloudBackupService.clearDatabase(req.body.confirmation);
            return res.json({ success: true, message: "Database records cleared", data });
        }
        catch (error) {
            return next(error);
        }
    }
    static async cleanup(_req, res, next) {
        try {
            const data = await maintenance_service_1.MaintenanceService.runCleanup();
            return res.json({
                success: true,
                message: "Maintenance cleanup completed",
                data,
            });
        }
        catch (error) {
            return next(error);
        }
    }
    static async prepareNextMonthPartitions(_req, res, next) {
        try {
            const data = await partition_service_1.PartitionService.createNextMonthPartitions();
            return res.json({
                success: true,
                message: "Next month partition preparation completed",
                data,
            });
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.MaintenanceController = MaintenanceController;
//# sourceMappingURL=maintenance.controller.js.map