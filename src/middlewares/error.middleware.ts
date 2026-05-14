import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError } from "../shared/utils/app-error";

export const errorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.issues,
    });
  }

  const message = error?.message || "Internal server error";

  const statusCode =
    error instanceof AppError
      ? error.statusCode
      : error?.statusCode
        ? error.statusCode
      : message.includes("Unauthorized")
        ? 401
        : message.includes("Forbidden")
          ? 403
          : message.includes("not found")
            ? 404
            : 400;

  return res.status(statusCode).json({
    success: false,
    message,
    errors: error instanceof AppError ? error.errors : error?.errors || [],
  });
};

export const errorMiddleware = errorHandler;
