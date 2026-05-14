import { Role } from "@prisma/client";
import { Request, Response, NextFunction } from "express";

export const allowRoles = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new Error("Unauthorized"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new Error("Forbidden: insufficient permission"));
    }

    next();
  };
};
