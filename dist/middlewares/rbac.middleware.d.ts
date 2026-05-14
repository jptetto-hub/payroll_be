import { Role } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
export declare const allowRoles: (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=rbac.middleware.d.ts.map