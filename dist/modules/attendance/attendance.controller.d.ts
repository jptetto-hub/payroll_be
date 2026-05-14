import { Request, Response, NextFunction } from "express";
type AttendanceParams = {
    id: string;
};
type EmployeeParams = {
    employeeId: string;
};
type RangeQuery = {
    from: string;
    to: string;
};
export declare class AttendanceController {
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static create(req: Request, res: Response, next: NextFunction): Promise<void>;
    static bulk(req: Request, res: Response, next: NextFunction): Promise<void>;
    static listByEmployee(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static listByRange(req: Request<EmployeeParams, unknown, unknown, RangeQuery>, res: Response, next: NextFunction): Promise<void>;
    static update(req: Request<AttendanceParams>, res: Response, next: NextFunction): Promise<void>;
    static delete(req: Request<AttendanceParams>, res: Response, next: NextFunction): Promise<void>;
    static bulkUpdate(req: Request, res: Response, next: NextFunction): Promise<void>;
    static bulkDelete(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=attendance.controller.d.ts.map