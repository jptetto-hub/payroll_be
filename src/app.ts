import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";

import { errorMiddleware } from "./middlewares/error.middleware";
import { auditContextMiddleware } from "./middlewares/audit-context.middleware";
import { requestTimingMiddleware } from "./middlewares/requestTiming.middleware";
import { responseSizeMiddleware } from "./middlewares/responseSize.middleware";
import { generalRateLimiter } from "./middlewares/rateLimit.middleware";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { prisma } from "./config/prisma";
import { redis } from "./config/redis";
import authRoutes from "./modules/auth/auth.routes";
import employeeRoutes from "./modules/employees/employee.routes";
import salaryHistoryRoutes from "./modules/salary-history/salary-history.routes";
import attendanceRoutes from "./modules/attendance/attendance.routes";
import attendanceRequestRoutes from "./modules/attendance-requests/attendance-request.routes";
import advanceRoutes from "./modules/advances/advance.routes";
import salaryCalculationRoutes from "./modules/salary-calculation/salary-calculation.routes";
import payrollRoutes from "./modules/payroll/payroll.routes";
import payslipRoutes from "./modules/payslips/payslip.routes";
import ledgerRoutes from "./modules/ledger/ledger.routes";
import schedulerRoutes from "./modules/scheduler/scheduler.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import auditLogRoutes from "./modules/audit-logs/audit-log.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import dashboardRoutes from "./modules/dashboard/dashboard.routes";
import maintenanceRoutes from "./modules/maintenance/maintenance.routes";
import healthRoutes from "./modules/health/health.routes";
import rbacTestRoutes from "./modules/auth/rbac-test.routes";
import { authMiddleware } from "./middlewares/auth.middleware";
import { requireFeaturePermission } from "./middlewares/feature-permission.middleware";

const app = express();

app.set("trust proxy", true);

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : [];
const isProduction = process.env.NODE_ENV === "production";

app.use(
  cors({
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
  }),
);
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
if (!isProduction) {
  app.use(morgan("dev"));
}
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  compression({
    threshold: 1024,
  }),
);
app.use(requestIdMiddleware);
app.use(responseSizeMiddleware);
app.use(generalRateLimiter);
app.use(requestTimingMiddleware);
app.use(auditContextMiddleware);

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
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      success: true,
      status: "OK",
      service: "database",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/health/redis", async (_req, res, next) => {
  try {
    const pong = await redis.ping();

    res.json({
      success: true,
      status: pong === "PONG" ? "OK" : "DEGRADED",
      service: "redis",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api/health", healthRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/test", rbacTestRoutes);

app.use("/api/employees", employeeRoutes);

app.use(
  "/api/salary-history",
  authMiddleware,
  requireFeaturePermission("SALARY_HISTORY"),
  salaryHistoryRoutes,
);

app.use(
  "/api/attendance",
  authMiddleware,
  requireFeaturePermission("ATTENDANCE"),
  attendanceRoutes,
);

app.use(
  "/api/attendance-requests",
  authMiddleware,
  requireFeaturePermission("ATTENDANCE"),
  attendanceRequestRoutes,
);

app.use(
  "/api/advances",
  authMiddleware,
  requireFeaturePermission("ADVANCES"),
  advanceRoutes,
);

app.use(
  "/api/salary-calculation",
  authMiddleware,
  requireFeaturePermission("SALARY_CALCULATION"),
  salaryCalculationRoutes,
);

app.use(
  "/api/payroll",
  authMiddleware,
  requireFeaturePermission("PAYROLL"),
  payrollRoutes,
);

app.use(
  "/api/payslips",
  authMiddleware,
  requireFeaturePermission("PAYSLIPS"),
  payslipRoutes,
);

app.use(
  "/api/ledger",
  authMiddleware,
  requireFeaturePermission("LEDGER"),
  ledgerRoutes,
);

app.use("/api/scheduler", schedulerRoutes);

app.use(
  "/api/reports",
  authMiddleware,
  requireFeaturePermission("REPORTS"),
  reportsRoutes,
);

app.use(
  "/api/audit-logs",
  authMiddleware,
  requireFeaturePermission("AUDIT_LOGS"),
  auditLogRoutes,
);

app.use("/api/settings", settingsRoutes);

app.use(
  "/api/dashboard",
  authMiddleware,
  requireFeaturePermission("DASHBOARD"),
  dashboardRoutes,
);

app.use("/api/maintenance", maintenanceRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    errors: [],
  });
});

app.use(errorMiddleware);

export default app;
