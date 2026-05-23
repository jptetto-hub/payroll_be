import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

const replaceRequestValue = (
  req: Request,
  key: "body" | "query" | "params",
  value: unknown,
) => {
  Object.defineProperty(req, key, {
    value,
    configurable: true,
    enumerable: true,
    writable: true,
  });
};

export const validate =
  (schema: ZodSchema) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return next(result.error);
    }

    const parsed = result.data as any;

    if (parsed.body !== undefined) {
      req.body = parsed.body;
    }

    if (parsed.query !== undefined) {
      replaceRequestValue(req, "query", parsed.query);
    }

    if (parsed.params !== undefined) {
      replaceRequestValue(req, "params", parsed.params);
    }

    next();
  };
