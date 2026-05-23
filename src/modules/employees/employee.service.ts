import bcrypt from "bcryptjs";
import { EmployeeRepository } from "./employee.repository";
import { EmployeeStatus, Role } from "@prisma/client";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { CacheService } from "../../utils/cache";
import { env } from "../../config/env";

const EMPLOYEE_OPTIONS_CACHE_TTL = 60 * 5;

export class EmployeeService {
  static async createEmployee(data: any, currentUserRole: Role) {
    const existingPhone = await EmployeeRepository.findByPhone(data.phone);

    if (existingPhone) {
      throw new Error("Employee phone number already exists");
    }

    if (data.email) {
      const existingEmail = await EmployeeRepository.findByEmail(data.email);

      if (existingEmail) {
        throw new Error("Employee email already exists");
      }
    }

    if (
      currentUserRole === Role.ADMIN &&
      (data.role === Role.ADMIN || data.role === Role.SUPER_ADMIN)
    ) {
      throw new Error("ADMIN can create only USER employees");
    }

    if (
      data.role === Role.SUPER_ADMIN &&
      currentUserRole !== Role.SUPER_ADMIN
    ) {
      throw new Error("Only SUPER_ADMIN can create SUPER_ADMIN");
    }

    const count = await EmployeeRepository.countEmployees();
    const employeeCode = `EMP${String(count + 1).padStart(3, "0")}`;

    const hashedPassword = await bcrypt.hash(data.password, env.bcryptSaltRounds);

    const employee = await EmployeeRepository.create({
      ...data,
      email: data.email || null,
      employeeCode,
      password: hashedPassword,
      joiningDate: new Date(data.joiningDate),
    });

    await Promise.all([
      CacheService.delByPattern("employee-options:*"),
      CacheService.delByPattern("dashboard-summary:*"),
    ]);

    return employee;
  }

  static async listEmployees(query: any) {
    const { page, limit, skip, take } = getPagination(query);

    const [employees, total] = await EmployeeRepository.list({
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
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async employeeOptions(query: any) {
    const search = String(query.search ?? query.q ?? "")
      .trim()
      .replace(/\s+/g, " ");
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 50);
    const key = CacheService.buildKey(
      "employee-options",
      search.toLowerCase() || "all",
      limit,
    );
    const cached = await CacheService.get<any[]>(key);

    if (cached) {
      return cached;
    }

    const employees = await EmployeeRepository.options({
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

    await CacheService.set(key, options, EMPLOYEE_OPTIONS_CACHE_TTL);

    return options;
  }

  static async getEmployeeById(id: string) {
    const employee = await EmployeeRepository.findById(id);

    if (!employee) {
      throw new Error("Employee not found");
    }

    return employee;
  }

  static async updateEmployee(id: string, data: any, currentUserRole: Role) {
    const employee = await this.getEmployeeById(id);

    if (currentUserRole === Role.ADMIN && employee.role === Role.SUPER_ADMIN) {
      throw new Error("ADMIN cannot update SUPER_ADMIN employee");
    }

    if (data.phone) {
      const existingPhone = await EmployeeRepository.findByPhone(data.phone);

      if (existingPhone && existingPhone.id !== id) {
        throw new Error("Phone number already used by another employee");
      }
    }

    if (data.email) {
      const existingEmail = await EmployeeRepository.findByEmail(data.email);

      if (existingEmail && existingEmail.id !== id) {
        throw new Error("Email already used by another employee");
      }
    }

    const updatedEmployee = await EmployeeRepository.update(id, {
      ...data,
      email: data.email === "" ? null : data.email,
      ...(data.joiningDate && { joiningDate: new Date(data.joiningDate) }),
    });

    await Promise.all([
      CacheService.delByPattern("employee-options:*"),
      CacheService.delByPattern("dashboard-summary:*"),
    ]);

    return updatedEmployee;
  }

  static async updateStatus(
    id: string,
    status: EmployeeStatus,
    currentUserRole: Role,
  ) {
    const employee = await this.getEmployeeById(id);

    if (currentUserRole === Role.ADMIN && employee.role !== Role.USER) {
      throw new Error("ADMIN can update status only for USER employees");
    }

    if (
      employee.role === Role.SUPER_ADMIN &&
      currentUserRole !== Role.SUPER_ADMIN
    ) {
      throw new Error("Only SUPER_ADMIN can update SUPER_ADMIN status");
    }

    const updatedEmployee = await EmployeeRepository.updateStatus(id, status);

    await Promise.all([
      CacheService.delByPattern("employee-options:*"),
      CacheService.delByPattern("dashboard-summary:*"),
    ]);

    return updatedEmployee;
  }

  static async updateRole(id: string, role: Role, currentUserRole: Role) {
    const employee = await this.getEmployeeById(id);

    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can update roles");
    }

    if (
      employee.id === id &&
      employee.role === Role.SUPER_ADMIN &&
      role !== Role.SUPER_ADMIN
    ) {
      throw new Error("SUPER_ADMIN role cannot be downgraded directly");
    }

    const updatedEmployee = await EmployeeRepository.updateRole(id, role);

    await CacheService.delByPattern("employee-options:*");

    return updatedEmployee;
  }
}
