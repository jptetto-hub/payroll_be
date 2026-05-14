import { Request, Response, NextFunction } from "express";
type SalaryHistoryParams = {
    id: string;
};
type EmployeeParams = {
    employeeId: string;
};
export declare class SalaryHistoryController {
    static create(req: Request, res: Response, next: NextFunction): Promise<void>;
    static listByEmployee(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static update(req: Request<SalaryHistoryParams>, res: Response, next: NextFunction): Promise<void>;
    static delete(req: Request<SalaryHistoryParams>, res: Response, next: NextFunction): Promise<void>;
    static current(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static resolve(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=salary-history.controller.d.ts.map