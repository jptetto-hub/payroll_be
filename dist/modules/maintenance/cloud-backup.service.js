"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudBackupService = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const prisma_1 = require("../../config/prisma");
const logger_1 = require("../../config/logger");
const app_error_1 = require("../../shared/utils/app-error");
const system_restart_service_1 = require("./system-restart.service");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const BACKEND_DIR = path_1.default.resolve(__dirname, "../../..");
const SCRIPTS_DIR = path_1.default.join(BACKEND_DIR, "scripts");
const VALID_BACKUP_TYPES = ["daily", "weekly", "monthly"];
const BUSINESS_TABLES = [
    "Payslip",
    "PayrollCarryForward",
    "LedgerEntry",
    "SchedulerRunItem",
    "Payroll",
    "AdvancePayment",
    "AttendanceRequest",
    "Attendance",
    "SalaryHistory",
    "DashboardSummary",
    "AuditLog",
    "AuditLogArchive",
    "Employee",
    "WorkHourSetting",
    "SystemSetting",
    "SchedulerRun",
    "WorkerHeartbeat",
];
const operations = new Map();
let activeOperationId = null;
const getR2Config = () => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET || "payroll-db-backups";
    if (!accountId || !/^[a-fA-F0-9]{32}$/.test(accountId)) {
        throw new app_error_1.AppError("R2_ACCOUNT_ID must be the 32-character Cloudflare Account ID", 503);
    }
    if (!accessKeyId || !secretAccessKey) {
        throw new app_error_1.AppError("Cloudflare R2 credentials are not configured", 503);
    }
    return {
        accountId,
        bucket,
        endpoint: process.env.R2_ENDPOINT_URL ||
            `https://${accountId}.r2.cloudflarestorage.com`,
        env: {
            ...process.env,
            AWS_ACCESS_KEY_ID: accessKeyId,
            AWS_SECRET_ACCESS_KEY: secretAccessKey,
            AWS_DEFAULT_REGION: process.env.R2_REGION || "auto",
        },
    };
};
const runAws = async (args) => {
    const config = getR2Config();
    const { stdout } = await execFileAsync("aws", ["--endpoint-url", config.endpoint, ...args], {
        cwd: BACKEND_DIR,
        env: config.env,
        timeout: Number(process.env.R2_API_TIMEOUT_MS || 30_000),
        maxBuffer: 10 * 1024 * 1024,
    });
    return stdout;
};
const parseBackupType = (value) => {
    if (typeof value !== "string" || !VALID_BACKUP_TYPES.includes(value)) {
        throw new app_error_1.AppError("backupType must be daily, weekly, or monthly", 400);
    }
    return value;
};
const validateObjectKey = (value) => {
    if (typeof value !== "string" ||
        !/^(daily|weekly|monthly)\/payroll_[A-Za-z0-9_-]+\.sql\.gz$/.test(value)) {
        throw new app_error_1.AppError("Invalid backup object key", 400);
    }
    return value;
};
const runScriptOperation = (params) => {
    if (activeOperationId) {
        throw new app_error_1.AppError("Another backup or restore operation is already running", 409);
    }
    const id = (0, crypto_1.randomUUID)();
    const operation = {
        id,
        type: params.type,
        status: "RUNNING",
        backupType: params.backupType,
        objectKey: params.objectKey,
        startedAt: new Date().toISOString(),
    };
    operations.set(id, operation);
    activeOperationId = id;
    const child = (0, child_process_1.spawn)("bash", [path_1.default.join(SCRIPTS_DIR, params.scriptName), ...(params.args ?? [])], {
        cwd: BACKEND_DIR,
        env: { ...process.env, ...params.env },
        stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const collect = (chunk) => {
        output = `${output}${chunk.toString()}`.slice(-4000);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) => {
        operation.status = "FAILED";
        operation.message = error.message;
        operation.completedAt = new Date().toISOString();
        activeOperationId = null;
    });
    child.on("close", (code) => {
        operation.status = code === 0 ? "COMPLETED" : "FAILED";
        operation.message =
            code === 0
                ? `${params.type === "BACKUP" ? "Backup" : "Restore"} completed`
                : output.trim() || `Operation failed with exit code ${code}`;
        operation.completedAt = new Date().toISOString();
        activeOperationId = null;
        logger_1.logger[code === 0 ? "info" : "error"]({ operation }, "Cloud backup operation finished");
        if (code === 0 && params.type === "RESTORE") {
            void system_restart_service_1.SystemRestartService.requireRestart("Cloud database restore completed").catch((error) => {
                logger_1.logger.error({ error }, "Failed to mark service restart required");
            });
        }
    });
    return operation;
};
const getIsoWeekStart = (year, week) => {
    const januaryFourth = new Date(Date.UTC(year, 0, 4));
    const day = januaryFourth.getUTCDay() || 7;
    januaryFourth.setUTCDate(januaryFourth.getUTCDate() - day + 1 + (week - 1) * 7);
    return januaryFourth;
};
const getBackupDate = (key) => {
    const daily = key.match(/^daily\/payroll_(\d{4})-(\d{2})-(\d{2})_/);
    if (daily)
        return new Date(Date.UTC(Number(daily[1]), Number(daily[2]) - 1, Number(daily[3])));
    const weekly = key.match(/^weekly\/payroll_week_(\d{4})-(\d{2})\.sql\.gz$/);
    if (weekly)
        return getIsoWeekStart(Number(weekly[1]), Number(weekly[2]));
    const monthly = key.match(/^monthly\/payroll_(\d{4})-(\d{2})\.sql\.gz$/);
    if (monthly)
        return new Date(Date.UTC(Number(monthly[1]), Number(monthly[2]) - 1, 1));
    return null;
};
const getRetentionCutoff = (type) => {
    const cutoff = new Date();
    const value = type === "daily"
        ? Number(process.env.R2_DAILY_RETENTION_DAYS || 15)
        : type === "weekly"
            ? Number(process.env.R2_WEEKLY_RETENTION_WEEKS || 4)
            : Number(process.env.R2_MONTHLY_RETENTION_MONTHS || 2);
    if (type === "daily")
        cutoff.setUTCDate(cutoff.getUTCDate() - value);
    if (type === "weekly")
        cutoff.setUTCDate(cutoff.getUTCDate() - value * 7);
    if (type === "monthly")
        cutoff.setUTCMonth(cutoff.getUTCMonth() - value);
    return cutoff;
};
class CloudBackupService {
    static async listBackups() {
        const config = getR2Config();
        const raw = await runAws(["s3api", "list-objects-v2", "--bucket", config.bucket, "--output", "json"]);
        const objects = (JSON.parse(raw || "{}").Contents ?? [])
            .filter((item) => /^(daily|weekly|monthly)\//.test(item.Key))
            .map((item) => ({
            key: item.Key,
            type: item.Key.split("/")[0],
            lastModified: item.LastModified,
            sizeBytes: item.Size,
            etag: item.ETag?.replaceAll('"', ""),
        }))
            .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
        return {
            bucket: config.bucket,
            objects,
            retention: {
                dailyDays: Number(process.env.R2_DAILY_RETENTION_DAYS || 15),
                weeklyWeeks: Number(process.env.R2_WEEKLY_RETENTION_WEEKS || 4),
                monthlyMonths: Number(process.env.R2_MONTHLY_RETENTION_MONTHS || 2),
                remoteDeleteEnabled: process.env.R2_REMOTE_DELETE_ENABLED === "true",
            },
            activeOperation: activeOperationId ? operations.get(activeOperationId) : null,
        };
    }
    static startBackup(value) {
        const backupType = parseBackupType(value);
        return runScriptOperation({
            type: "BACKUP",
            scriptName: "backup-db-r2.sh",
            backupType,
            env: { R2_BACKUP_MODE: backupType },
        });
    }
    static startScheduledBackup() {
        return runScriptOperation({
            type: "BACKUP",
            scriptName: "backup-db-r2.sh",
            env: { R2_BACKUP_MODE: "scheduled" },
        });
    }
    static startRestore(objectKey, confirmation) {
        if (confirmation !== "RESTORE_DATABASE") {
            throw new app_error_1.AppError("Type RESTORE_DATABASE to confirm restore", 400);
        }
        const validKey = validateObjectKey(objectKey);
        return runScriptOperation({
            type: "RESTORE",
            scriptName: "restore-db-r2.sh",
            args: [validKey],
            objectKey: validKey,
            env: {
                CONFIRM_DB_RESTORE: "RESTORE_DATABASE",
                ALLOW_PRODUCTION_DB_RESTORE: "true",
            },
        });
    }
    static getOperation(id) {
        const operation = operations.get(id);
        if (!operation) {
            throw new app_error_1.AppError("Backup operation not found", 404);
        }
        return operation;
    }
    static async cleanupExpired(params) {
        const { objects, retention } = await this.listBackups();
        const expired = objects.filter((item) => {
            const date = getBackupDate(item.key);
            return date ? date < getRetentionCutoff(item.type) : false;
        });
        const dryRun = params.dryRun !== false;
        if (dryRun) {
            return { dryRun: true, deleted: [], expired, retention };
        }
        if (!retention.remoteDeleteEnabled) {
            throw new app_error_1.AppError("Remote deletion is disabled. Set R2_REMOTE_DELETE_ENABLED=true to enable it.", 409);
        }
        if (params.confirmation !== "DELETE_EXPIRED_BACKUPS") {
            throw new app_error_1.AppError("Type DELETE_EXPIRED_BACKUPS to confirm remote deletion", 400);
        }
        const config = getR2Config();
        for (const item of expired) {
            await runAws(["s3api", "delete-object", "--bucket", config.bucket, "--key", item.key]);
        }
        return { dryRun: false, deleted: expired, expired, retention };
    }
    static async clearDatabase(confirmation) {
        if (confirmation !== "CLEAR_ALL_DATABASE_RECORDS") {
            throw new app_error_1.AppError("Type CLEAR_ALL_DATABASE_RECORDS to confirm database clear", 400);
        }
        const tables = BUSINESS_TABLES.map((table) => `"${table}"`).join(", ");
        await prisma_1.prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
        await system_restart_service_1.SystemRestartService.requireRestart("Database records cleared");
        return { cleared: true, tables: BUSINESS_TABLES };
    }
}
exports.CloudBackupService = CloudBackupService;
//# sourceMappingURL=cloud-backup.service.js.map