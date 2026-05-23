import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

export function responseSizeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    try {
      const sizeBytes = Buffer.byteLength(JSON.stringify(body));
      const warnSizeBytes = Number(
        process.env.RESPONSE_SIZE_WARN_BYTES || 500000,
      );

      if (sizeBytes >= warnSizeBytes) {
        logger.warn({
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          sizeKB: `${(sizeBytes / 1024).toFixed(2)}KB`,
        }, "Large API response");
      }
    } catch {
      // Response-size logging must never break the actual response.
    }

    return originalJson(body);
  };

  next();
}
