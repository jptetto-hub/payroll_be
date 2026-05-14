import { Request, Response, NextFunction } from "express";
type AdvanceParams = {
    id: string;
};
type EmployeeParams = {
    employeeId: string;
};
type CycleQuery = {
    cycleStartDate: string;
    cycleEndDate: string;
};
export declare class AdvanceController {
    static create(req: Request, res: Response, next: NextFunction): Promise<void>;
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static my(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getById(req: Request<AdvanceParams>, res: Response, next: NextFunction): Promise<void>;
    static listByEmployee(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static listByCycle(req: Request<EmployeeParams, unknown, unknown, CycleQuery>, res: Response, next: NextFunction): Promise<void>;
    static update(req: Request<AdvanceParams>, res: Response, next: NextFunction): Promise<void>;
    static delete(req: Request<AdvanceParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=advance.controller.d.ts.map