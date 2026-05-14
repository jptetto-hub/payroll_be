import { Request, Response, NextFunction } from "express";
export declare const errorHandler: (error: any, _req: Request, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
export declare const errorMiddleware: (error: any, _req: Request, res: Response, _next: NextFunction) => Response<any, Record<string, any>>;
//# sourceMappingURL=error.middleware.d.ts.map