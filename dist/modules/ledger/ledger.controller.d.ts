import { Request, Response, NextFunction } from "express";
type EmployeeParams = {
    employeeId: string;
};
type PayrollParams = {
    payrollId: string;
};
export declare class LedgerController {
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static my(req: Request, res: Response, next: NextFunction): Promise<void>;
    static employeeLedger(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static payrollLedger(req: Request<PayrollParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=ledger.controller.d.ts.map