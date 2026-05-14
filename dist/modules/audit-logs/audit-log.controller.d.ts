import { Request, Response, NextFunction } from "express";
type AuditLogParams = {
    id: string;
};
type UserParams = {
    userId: string;
};
export declare class AuditLogController {
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getById(req: Request<AuditLogParams>, res: Response, next: NextFunction): Promise<void>;
    static listByUser(req: Request<UserParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=audit-log.controller.d.ts.map