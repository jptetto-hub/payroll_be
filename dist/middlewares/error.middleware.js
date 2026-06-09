"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.errorHandler = void 0;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const app_error_1 = require("../shared/utils/app-error");
const audit_log_service_1 = require("../modules/audit-logs/audit-log.service");
const logger_1 = require("../config/logger");
const sentry_1 = require("../config/sentry");
const errorHandler = async (error, req, res, _next) => {
    const isPrismaTransactionTimeout = error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2028" ||
            error.message?.includes("Unable to start a transaction"));
    const statusCode = isPrismaTransactionTimeout
        ? 503
        : error instanceof app_error_1.AppError
            ? error.statusCode
            : error?.statusCode
                ? error.statusCode
                : error?.message?.includes("Unauthorized")
                    ? 401
                    : error?.message?.includes("Forbidden")
                        ? 403
                        : error?.message?.includes("not found")
                            ? 404
                            : error instanceof zod_1.ZodError
                                ? 400
                                : 500;
    audit_log_service_1.AuditLogService.log({
        userId: req.user?.id,
        action: error instanceof zod_1.ZodError
            ? "VALIDATION_FAILED"
            : statusCode === 401 || statusCode === 403
                ? "UNAUTHORIZED"
                : "FAILED",
        module: "API",
        entityId: typeof req.params?.id === "string" ? req.params.id : undefined,
        description: error instanceof zod_1.ZodError
            ? `Validation failed for ${req.method} ${req.originalUrl}`
            : `${req.method} ${req.originalUrl} failed`,
        status: "FAILED",
        newData: error instanceof zod_1.ZodError
            ? { issues: error.issues }
            : { message: error?.message || "Internal server error" },
    }).catch((auditError) => {
        logger_1.logger.error({ error: auditError }, "Audit failure log failed");
    });
    logger_1.logger.error({
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode,
        userId: req.user?.id,
        role: req.user?.role,
        error: {
            message: error?.message,
            stack: error?.stack,
        },
    }, "API request failed");
    if (process.env.SENTRY_DSN) {
        sentry_1.Sentry.captureException(error, {
            tags: {
                requestId: req.requestId,
                path: req.originalUrl,
                method: req.method,
            },
            user: {
                id: req.user?.id,
                role: req.user?.role,
            },
        });
    }
    if (error instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.issues,
        });
    }
    const message = isPrismaTransactionTimeout
        ? "Database is busy. Please retry in a moment."
        : process.env.NODE_ENV === "production" && statusCode >= 500
            ? "Internal server error"
            : error?.message || "Internal server error";
    return res.status(statusCode).json({
        success: false,
        message,
        errors: process.env.NODE_ENV === "production" && statusCode >= 500
            ? []
            : error instanceof app_error_1.AppError
                ? error.errors
                : error?.errors || [],
        ...(process.env.NODE_ENV !== "production" &&
            !isPrismaTransactionTimeout &&
            error?.stack && {
            stack: error.stack,
        }),
    });
};
exports.errorHandler = errorHandler;
exports.errorMiddleware = exports.errorHandler;
//# sourceMappingURL=error.middleware.js.map