import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const requestId = req.headers["x-request-id"]?.toString() || randomUUID();

  (req as any).requestId = requestId;
  res.setHeader("x-request-id", requestId);

  next();
}
