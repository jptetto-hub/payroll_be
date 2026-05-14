"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const dashboard_service_1 = require("./dashboard.service");
class DashboardController {
    static async summary(req, res, next) {
        try {
            const data = await dashboard_service_1.DashboardService.summary(req.query, req.user);
            res.json({
                success: true,
                message: "Dashboard summary fetched successfully",
                data,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async recentPayroll(req, res, next) {
        try {
            const result = await dashboard_service_1.DashboardService.recentPayroll(req.query, req.user);
            res.json({
                success: true,
                message: "Recent payroll fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async recentActivities(req, res, next) {
        try {
            const result = await dashboard_service_1.DashboardService.recentActivities(req.query, req.user);
            res.json({
                success: true,
                message: "Recent activities fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async analytics(req, res, next) {
        try {
            const data = await dashboard_service_1.DashboardService.analytics(req.query, req.user);
            res.json({
                success: true,
                message: "Dashboard analytics fetched successfully",
                data,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.DashboardController = DashboardController;
//# sourceMappingURL=dashboard.controller.js.map