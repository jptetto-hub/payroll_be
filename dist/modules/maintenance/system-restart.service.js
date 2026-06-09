"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemRestartService = void 0;
const crypto_1 = require("crypto");
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const redis_1 = require("../../config/redis");
const app_error_1 = require("../../shared/utils/app-error");
const RESTART_STATUS_KEY = "maintenance:system-restart-status";
const BACKEND_DIR = path_1.default.resolve(__dirname, "../../..");
const readStatus = async () => {
    const raw = await redis_1.redis.get(RESTART_STATUS_KEY);
    if (!raw) {
        return { id: "idle", status: "IDLE", reasons: [] };
    }
    return JSON.parse(raw);
};
const writeStatus = async (status) => {
    await redis_1.redis.set(RESTART_STATUS_KEY, JSON.stringify(status));
    return status;
};
class SystemRestartService {
    static getStatus() {
        return readStatus();
    }
    static async requireRestart(reason) {
        const current = await readStatus();
        const reasons = [...new Set([...current.reasons, reason])];
        return writeStatus({
            id: current.status === "RESTART_REQUIRED" ? current.id : (0, crypto_1.randomUUID)(),
            status: "RESTART_REQUIRED",
            reasons,
            requestedAt: current.requestedAt ?? new Date().toISOString(),
            message: "Service restart is required to finish maintenance changes.",
        });
    }
    static async startRestart(confirmation) {
        if (confirmation !== "RESTART_SERVICES") {
            throw new app_error_1.AppError("Type RESTART_SERVICES to confirm service restart", 400);
        }
        if (!process.env.APP_RESTART_COMMAND) {
            throw new app_error_1.AppError("APP_RESTART_COMMAND is not configured. Connect the restart API to PM2, systemd, Docker, or your deployment hook.", 503);
        }
        const current = await readStatus();
        if (current.status === "RESTARTING") {
            throw new app_error_1.AppError("Services are already restarting", 409);
        }
        const status = await writeStatus({
            id: (0, crypto_1.randomUUID)(),
            status: "RESTARTING",
            reasons: current.reasons,
            requestedAt: current.requestedAt ?? new Date().toISOString(),
            startedAt: new Date().toISOString(),
            message: "API, worker, and frontend restart command is running.",
        });
        const child = (0, child_process_1.spawn)(process.execPath, [path_1.default.join(BACKEND_DIR, "scripts", "restart-services-runner.js"), status.id], {
            cwd: BACKEND_DIR,
            detached: true,
            stdio: "ignore",
            env: process.env,
        });
        child.unref();
        return status;
    }
    static async dismiss() {
        return writeStatus({
            id: (0, crypto_1.randomUUID)(),
            status: "IDLE",
            reasons: [],
            message: "Restart notification dismissed.",
        });
    }
}
exports.SystemRestartService = SystemRestartService;
//# sourceMappingURL=system-restart.service.js.map