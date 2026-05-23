import { NextFunction, Request, Response } from "express";

export function cacheForSeconds(seconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Cache-Control",
      `private, max-age=${seconds}, stale-while-revalidate=${seconds}`,
    );
    next();
  };
}

export function noStore() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}
