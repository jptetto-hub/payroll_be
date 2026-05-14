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
        const hashedPassword = await bcryptjs_1.default.hash(data.password, 10);
        return employee_repository_1.EmployeeRepository.create({
            ...data,
            email: data.email || null,
            employeeCode,
            password: hashedPassword,
            joiningDate: new Date(data.joiningDate),
        });
    }
    static async listEmployees(query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [employees, total] = await employee_repository_1.EmployeeRepository.list({
            search: query.search,
            status: query.status,
            role: query.role,
            salaryType: query.salaryType,
            department: query.department,
            skip,
            take,
        });
        return {
            data: employees,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async getEmployeeById(id) {
        const employee = await employee_repository_1.EmployeeRepository.findById(id);
        if (!employee) {
            throw new Error("Employee not found");
        }
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
        return employee_repository_1.EmployeeRepository.update(id, {
            ...data,
            email: data.email === "" ? null : data.email,
            ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
        });
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
        return employee_repository_1.EmployeeRepository.updateStatus(id, status);
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
        return employee_repository_1.EmployeeRepository.updateRole(id, role);
    }
}
exports.EmployeeService = EmployeeService;
//# sourceMappingURL=employee.service.js.map