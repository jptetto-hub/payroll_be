"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const employee_repository_1 = require("./employee.repository");
const client_1 = require("@prisma/client");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cache_1 = require("../../utils/cache");
const env_1 = require("../../config/env");
const EMPLOYEE_OPTIONS_CACHE_TTL = 60 * 5;
const EMPLOYEE_OPTIONS_CACHE_PREFIX = "employee-options:v2";
const EMPLOYEE_LIST_CACHE_TTL = 30;
const EMPLOYEE_LIST_CACHE_PREFIX = "employee-list";
const EMPLOYEE_DETAIL_CACHE_TTL = 60;
const EMPLOYEE_DETAIL_CACHE_PREFIX = "employee-detail";
const invalidateEmployeeReadCaches = () => {
    void Promise.all([
        cache_1.CacheService.delByPattern("employee-options:*"),
        cache_1.CacheService.delByPattern(`${EMPLOYEE_LIST_CACHE_PREFIX}:*`),
        cache_1.CacheService.delByPattern(`${EMPLOYEE_DETAIL_CACHE_PREFIX}:*`),
        cache_1.CacheService.delByPattern("salary-history-read:*"),
        cache_1.CacheService.delByPattern("payroll-read:*"),
        cache_1.CacheService.delByPattern("payslip-read:*"),
        cache_1.CacheService.delByPattern("advance-read:*"),
        cache_1.CacheService.delByPattern("ledger-read:*"),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
    ]);
};
class EmployeeService {
    static async createEmployee(data, currentUserRole) {
        const existingPhone = await employee_repository_1.EmployeeRepository.findByPhone(data.phone);
        if (existingPhone) {
            throw new Error("Employee phone number already exists");
        }
        if (data.email) {
            const existingEmail = await employee_repository_1.EmployeeRepository.findByEmail(data.email);
            if (existingEmail) {
                throw new Error("Employee email already exists");
            }
        }
        if (currentUserRole === client_1.Role.ADMIN &&
            (data.role === client_1.Role.ADMIN || data.role === client_1.Role.SUPER_ADMIN)) {
            throw new Error("ADMIN can create only USER employees");
        }
        if (data.role === client_1.Role.SUPER_ADMIN &&
            currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can create SUPER_ADMIN");
        }
        const count = await employee_repository_1.EmployeeRepository.countEmployees();
        const employeeCode = `EMP${String(count + 1).padStart(3, "0")}`;
        const hashedPassword = await bcryptjs_1.default.hash(data.password, env_1.env.bcryptSaltRounds);
        const employee = await employee_repository_1.EmployeeRepository.create({
            ...data,
            email: data.email || null,
            employeeCode,
            password: hashedPassword,
            joiningDate: new Date(data.joiningDate),
        });
        invalidateEmployeeReadCaches();
        return employee;
    }
    static async listEmployees(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = cache_1.CacheService.buildKey(EMPLOYEE_LIST_CACHE_PREFIX, query.search?.trim().toLowerCase() || "all", query.status || "all", query.role || "all", query.salaryType || "all", query.department?.trim().toLowerCase() || "all", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [employees, total] = await employee_repository_1.EmployeeRepository.list({
            search: query.search,
            status: query.status,
            role: query.role,
            salaryType: query.salaryType,
            department: query.department,
            skip,
            take,
        });
        const result = {
            data: employees,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, EMPLOYEE_LIST_CACHE_TTL);
        return result;
    }
    static async employeeOptions(query) {
        const search = String(query.search ?? query.q ?? "")
            .trim()
            .replace(/\s+/g, " ");
        const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
        const key = cache_1.CacheService.buildKey(EMPLOYEE_OPTIONS_CACHE_PREFIX, search.toLowerCase() || "all", limit);
        const cached = await cache_1.CacheService.get(key);
        if (cached) {
            return cached;
        }
        const employees = await employee_repository_1.EmployeeRepository.options({
            search,
            limit,
        });
        const options = employees.map((employee) => ({
            id: employee.id,
            label: `${employee.employeeCode} - ${employee.name}`,
            name: employee.name,
            employeeCode: employee.employeeCode,
            salaryType: employee.salaryType,
            status: employee.status,
            role: employee.role,
        }));
        void cache_1.CacheService.set(key, options, EMPLOYEE_OPTIONS_CACHE_TTL);
        return options;
    }
    static async getEmployeeById(id, authUser) {
        if (authUser?.role === client_1.Role.USER && authUser.id !== id) {
            throw new Error("USER can view only own profile");
        }
        const cacheKey = cache_1.CacheService.buildKey(EMPLOYEE_DETAIL_CACHE_PREFIX, id);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const employee = await employee_repository_1.EmployeeRepository.findById(id);
        if (!employee) {
            throw new Error("Employee not found");
        }
        void cache_1.CacheService.set(cacheKey, employee, EMPLOYEE_DETAIL_CACHE_TTL);
        return employee;
    }
    static async updateEmployee(id, data, currentUserRole) {
        const employee = await this.getEmployeeById(id);
        if (currentUserRole === client_1.Role.ADMIN && employee.role === client_1.Role.SUPER_ADMIN) {
            throw new Error("ADMIN cannot update SUPER_ADMIN employee");
        }
        if (data.phone) {
            const existingPhone = await employee_repository_1.EmployeeRepository.findByPhone(data.phone);
            if (existingPhone && existingPhone.id !== id) {
                throw new Error("Phone number already used by another employee");
            }
        }
        if (data.email) {
            const existingEmail = await employee_repository_1.EmployeeRepository.findByEmail(data.email);
            if (existingEmail && existingEmail.id !== id) {
                throw new Error("Email already used by another employee");
            }
        }
        const updatedEmployee = await employee_repository_1.EmployeeRepository.update(id, {
            ...data,
            email: data.email === "" ? null : data.email,
            ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
        });
        invalidateEmployeeReadCaches();
        return updatedEmployee;
    }
    static async updateStatus(id, status, currentUserRole) {
        const employee = await this.getEmployeeById(id);
        if (currentUserRole === client_1.Role.ADMIN && employee.role !== client_1.Role.USER) {
            throw new Error("ADMIN can update status only for USER employees");
        }
        if (employee.role === client_1.Role.SUPER_ADMIN &&
            currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can update SUPER_ADMIN status");
        }
        const updatedEmployee = await employee_repository_1.EmployeeRepository.updateStatus(id, status);
        invalidateEmployeeReadCaches();
        return updatedEmployee;
    }
    static async updateRole(id, role, currentUserRole) {
        const employee = await this.getEmployeeById(id);
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can update roles");
        }
        if (employee.id === id &&
            employee.role === client_1.Role.SUPER_ADMIN &&
            role !== client_1.Role.SUPER_ADMIN) {
            throw new Error("SUPER_ADMIN role cannot be downgraded directly");
        }
        const updatedEmployee = await employee_repository_1.EmployeeRepository.updateRole(id, role);
        invalidateEmployeeReadCaches();
        return updatedEmployee;
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employee.service.js.map