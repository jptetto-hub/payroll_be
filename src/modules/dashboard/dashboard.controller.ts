import { Request, Response, NextFunction } from "express";
import { DashboardService } from "./dashboard.service";

export class DashboardController {
  static async summary(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.summary(req.query, req.user);

      res.json({
        success: true,
        message: "Dashboard summary fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async recentPayroll(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await DashboardService.recentPayroll(req.query, req.user);

      res.json({
        success: true,
        message: "Recent payroll fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async recentActivities(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await DashboardService.recentActivities(
        req.query,
        req.user,
      );

      res.json({
        success: true,
        message: "Recent activities fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async analytics(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.analytics(req.query, req.user);

      res.json({
        success: true,
        message: "Dashboard analytics fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }
}
