import { Request, Response, NextFunction } from "express";
export declare class ReportsController {
    static salary(req: Request, res: Response, next: NextFunction): Promise<void>;
    static salaryExport(req: Request, res: Response, next: NextFunction): Promise<void>;
    static attendance(req: Request, res: Response, next: NextFunction): Promise<void>;
    static attendanceExport(req: Request, res: Response, next: NextFunction): Promise<void>;
    static advance(req: Request, res: Response, next: NextFunction): Promise<void>;
    static advanceExport(req: Request, res: Response, next: NextFunction): Promise<void>;
    static salaryExportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    static attendanceExportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    static advanceExportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
    static allInOne(req: Request, res: Response, next: NextFunction): Promise<void>;
    static allInOneExport(req: Request, res: Response, next: NextFunction): Promise<void>;
    static allInOneExportExcel(req: Request, res: Response, next: NextFunction): Promise<void>;
}
//# sourceMappingURL=reports.controller.d.ts.map