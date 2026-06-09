"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeController = void 0;
const employee_service_1 = require("./employee.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
class EmployeeController {
    static async create(req, res, next) {
        try {
            const employee = await employee_service_1.EmployeeService.createEmployee(req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "CREATE",
                module: "EMPLOYEE",
                newData: employee,
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.status(201).json({
                success: true,
                message: "Employee created successfully",
                data: employee,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async list(req, res, next) {
        try {
            const result = await employee_service_1.EmployeeService.listEmployees(req.query);
            res.json({
                success: true,
                message: "Employees fetched successfully",
                data: result.data,
                pagination: result.pagination,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async options(req, res, next) {
        try {
            const employees = await employee_service_1.EmployeeService.employeeOptions(req.query);
            res.json({
                success: true,
                data: employees,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getById(req, res, next) {
        try {
            const employee = await employee_service_1.EmployeeService.getEmployeeById(req.params.id, req.user);
            res.json({
                success: true,
                message: "Employee fetched successfully",
                data: employee,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        try {
            const employee = await employee_service_1.EmployeeService.updateEmployee(req.params.id, req.body, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "EMPLOYEE",
                newData: employee,
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Employee updated successfully",
                data: employee,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateStatus(req, res, next) {
        try {
            const employee = await employee_service_1.EmployeeService.updateStatus(req.params.id, req.body.status, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "UPDATE",
                module: "EMPLOYEE_STATUS",
                newData: {
                    employeeId: employee.id,
                    status: employee.status,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Employee status updated successfully",
                data: employee,
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateRole(req, res, next) {
        try {
            const employee = await employee_service_1.EmployeeService.updateRole(req.params.id, req.body.role, req.user.role);
            await audit_log_service_1.AuditLogService.log({
                userId: req.user.id,
                action: "ROLE_CHANGE",
                module: "EMPLOYEE_ROLE",
                newData: {
                    employeeId: employee.id,
                    role: employee.role,
                },
                ipAddress: req.ip,
                skipRelationValidation: true,
            });
            res.json({
                success: true,
                message: "Employee role updated successfully",
                data: employee,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.EmployeeController = EmployeeController;
//# sourceMappingURL=employee.controller.js.map