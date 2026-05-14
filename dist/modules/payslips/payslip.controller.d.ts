import { Request, Response, NextFunction } from "express";
type PayslipParams = {
    id: string;
};
type PayrollParams = {
    payrollId: string;
};
type EmployeeParams = {
    employeeId: string;
};
export declare class PayslipController {
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static my(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getById(req: Request<PayslipParams>, res: Response, next: NextFunction): Promise<void>;
    static getByPayroll(req: Request<PayrollParams>, res: Response, next: NextFunction): Promise<void>;
    static listByEmployee(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=payslip.controller.d.ts.map