import { randomUUID } from "crypto";
import { execFile, spawn } from "child_process";
import path from "path";
import { promisify } from "util";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { AppError } from "../../shared/utils/app-error";
import { SystemRestartService } from "./system-restart.service";

const execFileAsync = promisify(execFile);
const BACKEND_DIR = path.resolve(__dirname, "../../..");
const SCRIPTS_DIR = path.join(BACKEND_DIR, "scripts");
const VALID_BACKUP_TYPES = ["daily", "weekly", "monthly"] as const;
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

type BackupType = (typeof VALID_BACKUP_TYPES)[number];
type OperationType = "BACKUP" | "RESTORE";
type OperationStatus = "RUNNING" | "COMPLETED" | "FAILED";

type Operation = {
  id: string;
  type: OperationType;
  status: OperationStatus;
  backupType?: BackupType;
  objectKey?: string;
  startedAt: string;
  completedAt?: string;
  message?: string;
};

type R2Object = {
  Key: string;
  LastModified: string;
  Size: number;
  ETag?: string;
};

const operations = new Map<string, Operation>();
let activeOperationId: string | null = null;

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || "payroll-db-backups";

  if (!accountId || !/^[a-fA-F0-9]{32}$/.test(accountId)) {
    throw new AppError("R2_ACCOUNT_ID must be the 32-character Cloudflare Account ID", 503);
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new AppError("Cloudflare R2 credentials are not configured", 503);
  }

  return {
    accountId,
    bucket,
    endpoint:
      process.env.R2_ENDPOINT_URL ||
      `https://${accountId}.r2.cloudflarestorage.com`,
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AWS_DEFAULT_REGION: process.env.R2_REGION || "auto",
    },
  };
};

const runAws = async (args: string[]) => {
  const config = getR2Config();
  const { stdout } = await execFileAsync(
    "aws",
    ["--endpoint-url", config.endpoint, ...args],
    {
      cwd: BACKEND_DIR,
      env: config.env,
      timeout: Number(process.env.R2_API_TIMEOUT_MS || 30_000),
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  return stdout;
};

const parseBackupType = (value: unknown): BackupType => {
  if (typeof value !== "string" || !VALID_BACKUP_TYPES.includes(value as BackupType)) {
    throw new AppError("backupType must be daily, weekly, or monthly", 400);
  }

  return value as BackupType;
};

const validateObjectKey = (value: unknown) => {
  if (
    typeof value !== "string" ||
    !/^(daily|weekly|monthly)\/payroll_[A-Za-z0-9_-]+\.sql\.gz$/.test(value)
  ) {
    throw new AppError("Invalid backup object key", 400);
  }

  return value;
};

const runScriptOperation = (params: {
  type: OperationType;
  scriptName: string;
  args?: string[];
  env?: NodeJS.ProcessEnv;
  backupType?: BackupType;
  objectKey?: string;
}) => {
  if (activeOperationId) {
    throw new AppError("Another backup or restore operation is already running", 409);
  }

  const id = randomUUID();
  const operation: Operation = {
    id,
    type: params.type,
    status: "RUNNING",
    backupType: params.backupType,
    objectKey: params.objectKey,
    startedAt: new Date().toISOString(),
  };
  operations.set(id, operation);
  activeOperationId = id;

  const child = spawn("bash", [path.join(SCRIPTS_DIR, params.scriptName), ...(params.args ?? [])], {
    cwd: BACKEND_DIR,
    env: { ...process.env, ...params.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const collect = (chunk: Buffer) => {
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
    logger[code === 0 ? "info" : "error"]({ operation }, "Cloud backup operation finished");

    if (code === 0 && params.type === "RESTORE") {
      void SystemRestartService.requireRestart(
        "Cloud database restore completed",
      ).catch((error) => {
        logger.error({ error }, "Failed to mark service restart required");
      });
    }
  });

  return operation;
};

const getIsoWeekStart = (year: number, week: number) => {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const day = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(januaryFourth.getUTCDate() - day + 1 + (week - 1) * 7);
  return januaryFourth;
};

const getBackupDate = (key: string) => {
  const daily = key.match(/^daily\/payroll_(\d{4})-(\d{2})-(\d{2})_/);
  if (daily) return new Date(Date.UTC(Number(daily[1]), Number(daily[2]) - 1, Number(daily[3])));

  const weekly = key.match(/^weekly\/payroll_week_(\d{4})-(\d{2})\.sql\.gz$/);
  if (weekly) return getIsoWeekStart(Number(weekly[1]), Number(weekly[2]));

  const monthly = key.match(/^monthly\/payroll_(\d{4})-(\d{2})\.sql\.gz$/);
  if (monthly) return new Date(Date.UTC(Number(monthly[1]), Number(monthly[2]) - 1, 1));

  return null;
};

const getRetentionCutoff = (type: BackupType) => {
  const cutoff = new Date();
  const value =
    type === "daily"
      ? Number(process.env.R2_DAILY_RETENTION_DAYS || 15)
      : type === "weekly"
        ? Number(process.env.R2_WEEKLY_RETENTION_WEEKS || 4)
        : Number(process.env.R2_MONTHLY_RETENTION_MONTHS || 2);

  if (type === "daily") cutoff.setUTCDate(cutoff.getUTCDate() - value);
  if (type === "weekly") cutoff.setUTCDate(cutoff.getUTCDate() - value * 7);
  if (type === "monthly") cutoff.setUTCMonth(cutoff.getUTCMonth() - value);

  return cutoff;
};

export class CloudBackupService {
  static async listBackups() {
    const config = getR2Config();
    const raw = await runAws(["s3api", "list-objects-v2", "--bucket", config.bucket, "--output", "json"]);
    const objects = ((JSON.parse(raw || "{}").Contents ?? []) as R2Object[])
      .filter((item) => /^(daily|weekly|monthly)\//.test(item.Key))
      .map((item) => ({
        key: item.Key,
        type: item.Key.split("/")[0] as BackupType,
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

  static startBackup(value: unknown) {
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

  static startRestore(objectKey: unknown, confirmation: unknown) {
    if (confirmation !== "RESTORE_DATABASE") {
      throw new AppError("Type RESTORE_DATABASE to confirm restore", 400);
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

  static getOperation(id: string) {
    const operation = operations.get(id);

    if (!operation) {
      throw new AppError("Backup operation not found", 404);
    }

    return operation;
  }

  static async cleanupExpired(params: { confirmation?: unknown; dryRun?: boolean }) {
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
      throw new AppError("Remote deletion is disabled. Set R2_REMOTE_DELETE_ENABLED=true to enable it.", 409);
    }

    if (params.confirmation !== "DELETE_EXPIRED_BACKUPS") {
      throw new AppError("Type DELETE_EXPIRED_BACKUPS to confirm remote deletion", 400);
    }

    const config = getR2Config();
    for (const item of expired) {
      await runAws(["s3api", "delete-object", "--bucket", config.bucket, "--key", item.key]);
    }

    return { dryRun: false, deleted: expired, expired, retention };
  }

  static async clearDatabase(confirmation: unknown) {
    if (confirmation !== "CLEAR_ALL_DATABASE_RECORDS") {
      throw new AppError("Type CLEAR_ALL_DATABASE_RECORDS to confirm database clear", 400);
    }

    const tables = BUSINESS_TABLES.map((table) => `"${table}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
    await SystemRestartService.requireRestart("Database records cleared");

    return { cleared: true, tables: BUSINESS_TABLES };
  }
}
