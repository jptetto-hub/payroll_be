import { Request, Response, NextFunction } from "express";
type EmployeeParams = {
    id: string;
};
export declare class EmployeeController {
    static create(req: Request, res: Response, next: NextFunction): Promise<void>;
    static list(req: Request, res: Response, next: NextFunction): Promise<void>;
    static getById(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static update(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static updateStatus(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
    static updateRole(req: Request<EmployeeParams>, res: Response, next: NextFunction): Promise<void>;
}
export {};
//# sourceMappingURL=employee.controller.d.ts.map