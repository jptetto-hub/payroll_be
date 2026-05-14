import { Request, Response, NextFunction } from "express";
type PayrollParams = {
    id: string;
};
type EmployeeParams = {
    employeeId: string;
};
export declare class PayrollController {
    static generate(req: Request, res: Response, next: NextFunction): Promise<void>;
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getById(req: Request<PayrollParams>, res: Response, next: NextFunction): Promise<void>;
    static listByEmployee(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static delete(req: Request<PayrollParams>, res: Response, next: NextFunction): Promise<void>;
    static recalculate(req: Request<PayrollParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=payroll.controller.d.ts.map