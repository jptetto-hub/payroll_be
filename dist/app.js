"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const compression_1 = __importDefault(require("compression"));
const error_middleware_1 = require("./middlewares/error.middleware");
const audit_context_middleware_1 = require("./middlewares/audit-context.middleware");
const requestTiming_middleware_1 = require("./middlewares/requestTiming.middleware");
const responseSize_middleware_1 = require("./middlewares/responseSize.middleware");
const rateLimit_middleware_1 = require("./middlewares/rateLimit.middleware");
const requestId_middleware_1 = require("./middlewares/requestId.middleware");
const prisma_1 = require("./config/prisma");
const redis_1 = require("./config/redis");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const employee_routes_1 = __importDefault(require("./modules/employees/employee.routes"));
const salary_history_routes_1 = __importDefault(require("./modules/salary-history/salary-history.routes"));
const attendance_routes_1 = __importDefault(require("./modules/attendance/attendance.routes"));
const attendance_request_routes_1 = __importDefault(require("./modules/attendance-requests/attendance-request.routes"));
const advance_routes_1 = __importDefault(require("./modules/advances/advance.routes"));
const salary_calculation_routes_1 = __importDefault(require("./modules/salary-calculation/salary-calculation.routes"));
const payroll_routes_1 = __importDefault(require("./modules/payroll/payroll.routes"));
const payslip_routes_1 = __importDefault(require("./modules/payslips/payslip.routes"));
const ledger_routes_1 = __importDefault(require("./modules/ledger/ledger.routes"));
const scheduler_routes_1 = __importDefault(require("./modules/scheduler/scheduler.routes"));
const reports_routes_1 = __importDefault(require("./modules/reports/reports.routes"));
const audit_log_routes_1 = __importDefault(require("./modules/audit-logs/audit-log.routes"));
const settings_routes_1 = __importDefault(require("./modules/settings/settings.routes"));
const dashboard_routes_1 = __importDefault(require("./modules/dashboard/dashboard.routes"));
const maintenance_routes_1 = __importDefault(require("./modules/maintenance/maintenance.routes"));
const health_routes_1 = __importDefault(require("./modules/health/health.routes"));
const rbac_test_routes_1 = __importDefault(require("./modules/auth/rbac-test.routes"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
const feature_permission_middleware_1 = require("./middlewares/feature-permission.middleware");
const app = (0, express_1.default)();
app.set("trust proxy", true);
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : [];
const isProduction = process.env.NODE_ENV === "production";
app.use((0, cors_1.default)({
    origin(origin, callback) {
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        if (!isProduction && allowedOrigins.length === 0) {
            callback(null, true);
            return;
        }
        callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
}));
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: false,
}));
if (!isProduction) {
    app.use((0, morgan_1.default)("dev"));
}
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "1mb" }));
app.use((0, compression_1.default)({
    threshold: 1024,
}));
app.use(requestId_middleware_1.requestIdMiddleware);
app.use(responseSize_middleware_1.responseSizeMiddleware);
app.use(rateLimit_middleware_1.generalRateLimiter);
app.use(requestTiming_middleware_1.requestTimingMiddleware);
app.use(audit_context_middleware_1.auditContextMiddleware);
app.get("/health", (_req, res) => {
    res.json({
        success: true,
        message: "Payroll Attendance API running",
    });
});
app.get("/api/health", (_req, res) => {
    res.json({
        success: true,
        status: "OK",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
app.get("/api/health/db", async (_req, res, next) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({
            success: true,
            status: "OK",
            service: "database",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        next(error);
    }
});
app.get("/api/health/redis", async (_req, res, next) => {
    try {
        const pong = await redis_1.redis.ping();
        res.json({
            success: true,
            status: pong === "PONG" ? "OK" : "DEGRADED",
            service: "redis",
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        next(error);
    }
});
app.use("/api/health", health_routes_1.default);
app.use("/api/auth", auth_routes_1.default);
app.use("/api/test", rbac_test_routes_1.default);
app.use("/api/employees", employee_routes_1.default);
app.use("/api/salary-history", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("SALARY_HISTORY"), salary_history_routes_1.default);
app.use("/api/attendance", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("ATTENDANCE"), attendance_routes_1.default);
app.use("/api/attendance-requests", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("ATTENDANCE"), attendance_request_routes_1.default);
app.use("/api/advances", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("ADVANCES"), advance_routes_1.default);
app.use("/api/salary-calculation", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("SALARY_CALCULATION"), salary_calculation_routes_1.default);
app.use("/api/payroll", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("PAYROLL"), payroll_routes_1.default);
app.use("/api/payslips", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("PAYSLIPS"), payslip_routes_1.default);
app.use("/api/ledger", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("LEDGER"), ledger_routes_1.default);
app.use("/api/scheduler", scheduler_routes_1.default);
app.use("/api/reports", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("REPORTS"), reports_routes_1.default);
app.use("/api/audit-logs", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("AUDIT_LOGS"), audit_log_routes_1.default);
app.use("/api/settings", settings_routes_1.default);
app.use("/api/dashboard", auth_middleware_1.authMiddleware, (0, feature_permission_middleware_1.requireFeaturePermission)("DASHBOARD"), dashboard_routes_1.default);
app.use("/api/maintenance", maintenance_routes_1.default);
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        errors: [],
    });
});
app.use(error_middleware_1.errorMiddleware);
exports.default = app;
//# sourceMappingURL=app.js.map