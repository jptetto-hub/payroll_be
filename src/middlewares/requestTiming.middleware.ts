import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export function requestTimingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const endedAt = process.hrtime.bigint();
    const durationMs = Number(endedAt - startedAt) / 1_000_000;
    const slowApiMs = Number(process.env.SLOW_API_MS || 1000);
    const logPayload = {
      requestId: (req as any).requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      userId: (req as any).user?.id,
      role: (req as any).user?.role,
    };

    if (durationMs >= slowApiMs) {
      logger.warn(logPayload, "Slow API request");
    } else if (process.env.LOG_API_REQUESTS === "true") {
      logger.info(logPayload, "API request completed");
    }
  });

  next();
}
