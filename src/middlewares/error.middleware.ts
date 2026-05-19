import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/utils/app-error";
import { AuditLogService } from "../modules/audit-logs/audit-log.service";

export const errorHandler = async (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const statusCode =
    error instanceof AppError
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
                : 400;

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
    console.error("Audit failure log failed:", auditError);
  });

  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.issues,
    });
  }

  const message = error?.message || "Internal server error";

  return res.status(statusCode).json({
    success: false,
    message,
    errors: error instanceof AppError ? error.errors : error?.errors || [],
  });
};

export const errorMiddleware = errorHandler;
