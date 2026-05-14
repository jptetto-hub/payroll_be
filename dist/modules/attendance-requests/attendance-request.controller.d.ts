import { Request, Response, NextFunction } from "express";
type AttendanceRequestParams = {
    id: string;
};
export declare class AttendanceRequestController {
    static create(req: Request, res: Response, next: NextFunction): Promise<void>;
    static myRequests(req: Request, res: Response, next: NextFunction): Promise<void>;
    static pendingRequests(req: Request, res: Response, next: NextFunction): Promise<void>;
    static decision(req: Request, res: Response, next: NextFunction): Promise<void>;
    static approve(req: Request<AttendanceRequestParams>, res: Response, next: NextFunction): Promise<void>;
    static reject(req: Request<AttendanceRequestParams>, res: Response, next: NextFunction): Promise<void>;
    static deleteOwn(req: Request<AttendanceRequestParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=attendance-request.controller.d.ts.map