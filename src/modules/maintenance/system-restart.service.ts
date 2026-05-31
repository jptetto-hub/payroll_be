import { randomUUID } from "crypto";
import { spawn } from "child_process";
import path from "path";
import { redis } from "../../config/redis";
import { AppError } from "../../shared/utils/app-error";

const RESTART_STATUS_KEY = "maintenance:system-restart-status";
const BACKEND_DIR = path.resolve(__dirname, "../../..");

export type SystemRestartStatus = {
  id: string;
  status: "IDLE" | "RESTART_REQUIRED" | "RESTARTING" | "COMPLETED" | "FAILED";
  reasons: string[];
  requestedAt?: string;
  startedAt?: string;
  completedAt?: string;
  message?: string;
};

const readStatus = async (): Promise<SystemRestartStatus> => {
  const raw = await redis.get(RESTART_STATUS_KEY);

  if (!raw) {
    return { id: "idle", status: "IDLE", reasons: [] };
  }

  return JSON.parse(raw) as SystemRestartStatus;
};

const writeStatus = async (status: SystemRestartStatus) => {
  await redis.set(RESTART_STATUS_KEY, JSON.stringify(status));
  return status;
};

export class SystemRestartService {
  static getStatus() {
    return readStatus();
  }

  static async requireRestart(reason: string) {
    const current = await readStatus();
    const reasons = [...new Set([...current.reasons, reason])];

    return writeStatus({
      id: current.status === "RESTART_REQUIRED" ? current.id : randomUUID(),
      status: "RESTART_REQUIRED",
      reasons,
      requestedAt: current.requestedAt ?? new Date().toISOString(),
      message: "Service restart is required to finish maintenance changes.",
    });
  }

  static async startRestart(confirmation: unknown) {
    if (confirmation !== "RESTART_SERVICES") {
      throw new AppError("Type RESTART_SERVICES to confirm service restart", 400);
    }

    if (!process.env.APP_RESTART_COMMAND) {
      throw new AppError(
        "APP_RESTART_COMMAND is not configured. Connect the restart API to PM2, systemd, Docker, or your deployment hook.",
        503,
      );
    }

    const current = await readStatus();

    if (current.status === "RESTARTING") {
      throw new AppError("Services are already restarting", 409);
    }

    const status = await writeStatus({
      id: randomUUID(),
      status: "RESTARTING",
      reasons: current.reasons,
      requestedAt: current.requestedAt ?? new Date().toISOString(),
      startedAt: new Date().toISOString(),
      message: "API, worker, and frontend restart command is running.",
    });
    const child = spawn(
      process.execPath,
      [path.join(BACKEND_DIR, "scripts", "restart-services-runner.js"), status.id],
      {
        cwd: BACKEND_DIR,
        detached: true,
        stdio: "ignore",
        env: process.env,
      },
    );
    child.unref();

    return status;
  }

  static async dismiss() {
    return writeStatus({
      id: randomUUID(),
      status: "IDLE",
      reasons: [],
      message: "Restart notification dismissed.",
    });
  }
}
