import { Request, Response, NextFunction } from "express";
import { Role } from "@prisma/client";
import { DashboardService } from "./dashboard.service";
import {
  DashboardSummaryService,
  parseDashboardSummaryRange,
} from "./dashboard-summary.service";

export class DashboardController {
  static async summary(req: Request, res: Response, next: NextFunction) {
    try {
      if (
        (req.user.role === Role.ADMIN || req.user.role === Role.SUPER_ADMIN) &&
        (!req.query.employeeId || req.query.employeeId === "all")
      ) {
        const range = parseDashboardSummaryRange(req.query);
        const data = await DashboardSummaryService.getOrRefreshGlobalSummary(
          range,
        );

        return res.json({
          success: true,
          message: "Dashboard summary fetched successfully",
          data,
        });
      }

      const data = await DashboardService.summary(req.query, req.user);

      return res.json({
        success: true,
        message: "Dashboard summary fetched successfully",
        data,
      });
    } catch (error) {
      next(error);
    }
  }

  static async refreshSummary(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const range = parseDashboardSummaryRange(req.body);
      const data = await DashboardSummaryService.refreshGlobalSummary(range);

      return res.json({
        success: true,
        message: "Dashboard summary refreshed",
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
