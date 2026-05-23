import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../shared/utils/app-error";
import { AuditLogService } from "../modules/audit-logs/audit-log.service";
import { logger } from "../config/logger";
import { Sentry } from "../config/sentry";

export const errorHandler = async (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const isPrismaTransactionTimeout =
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2028" ||
      error.message?.includes("Unable to start a transaction"));

  const statusCode =
    isPrismaTransactionTimeout
      ? 503
      : error instanceof AppError
      ? error.statusCode
      : error?.statusCode
        ? error.statusCode
        : error?.message?.includes("Unauthorized")
          ? 401
          : error?.message?.includes("Forbidden")
            ? 403
            : error?.message?.includes("not found")
              ? 404
              : error instanceof ZodError
                ? 400
                : 500;

  AuditLogService.log({
    userId: req.user?.id,
    action:
      error instanceof ZodError
        ? ("VALIDATION_FAILED" as any)
        : statusCode === 401 || statusCode === 403
          ? ("UNAUTHORIZED" as any)
          : ("FAILED" as any),
    module: "API",
    entityId:
      typeof req.params?.id === "string" ? req.params.id : undefined,
    description:
      error instanceof ZodError
        ? `Validation failed for ${req.method} ${req.originalUrl}`
        : `${req.method} ${req.originalUrl} failed`,
    status: "FAILED",
    newData:
      error instanceof ZodError
        ? { issues: error.issues }
        : { message: error?.message || "Internal server error" },
  }).catch((auditError) => {
    logger.error({ error: auditError }, "Audit failure log failed");
  });

  logger.error(
    {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      userId: req.user?.id,
      role: req.user?.role,
      error: {
        message: error?.message,
        stack: error?.stack,
      },
    },
    "API request failed",
  );

  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      tags: {
        requestId: (req as any).requestId,
        path: req.originalUrl,
        method: req.method,
      },
      user: {
        id: req.user?.id,
        role: req.user?.role,
      },
    });
  }

  if (error instanceof ZodError) {
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
    errors:
      process.env.NODE_ENV === "production" && statusCode >= 500
        ? []
        : error instanceof AppError
          ? error.errors
          : error?.errors || [],
    ...(process.env.NODE_ENV !== "production" &&
      !isPrismaTransactionTimeout &&
      error?.stack && {
        stack: error.stack,
      }),
  });
};

export const errorMiddleware = errorHandler;
