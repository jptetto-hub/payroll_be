"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const client_1 = require("@prisma/client");
const dashboard_service_1 = require("./dashboard.service");
const dashboard_summary_service_1 = require("./dashboard-summary.service");
class DashboardController {
    static async summary(req, res, next) {
        try {
            if ((req.user.role === client_1.Role.ADMIN || req.user.role === client_1.Role.SUPER_ADMIN) &&
                (!req.query.employeeId || req.query.employeeId === "all")) {
                const range = (0, dashboard_summary_service_1.parseDashboardSummaryRange)(req.query);
                const data = await dashboard_summary_service_1.DashboardSummaryService.getOrRefreshGlobalSummary(range);
                return res.json({
                    success: true,
                    message: "Dashboard summary fetched successfully",
                    data,
                });
            }
            const data = await dashboard_service_1.DashboardService.summary(req.query, req.user);
            return res.json({
                success: true,
                message: "Dashboard summary fetched successfully",
                data,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async refreshSummary(req, res, next) {
        try {
            const range = (0, dashboard_summary_service_1.parseDashboardSummaryRange)(req.body);
            const data = await dashboard_summary_service_1.DashboardSummaryService.refreshGlobalSummary(range);
            return res.json({
                success: true,
                message: "Dashboard summary refreshed",
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