import { prisma, readPrisma } from "../../config/prisma";
import { EmployeeStatus, Role, SalaryType } from "@prisma/client";

type CreateEmployeeInput = {
  employeeCode: string;
  name: string;
  email?: string;
  password: string;
  phone: string;
  address?: string;
  designation?: string;
  department?: string;
  joiningDate: Date;
  salaryType: SalaryType;
  role: Role;
  profileImage?: string;
};

export class EmployeeRepository {
  static create(data: CreateEmployeeInput) {
    return prisma.employee.create({
      data,
      select: this.defaultSelect(),
    });
  }

  static findByEmail(email: string) {
    return prisma.employee.findUnique({ where: { email } });
  }

  static findByPhone(phone: string) {
    return prisma.employee.findUnique({ where: { phone } });
  }

  static findById(id: string) {
    return readPrisma.employee.findUnique({
      where: { id },
      select: this.defaultSelect(),
    });
  }

  static countEmployees() {
    return readPrisma.employee.count();
  }

  static list(params: {
    search?: string;
    status?: EmployeeStatus;
    role?: Role;
    salaryType?: SalaryType;
    department?: string;
    skip: number;
    take: number;
  }) {
    const normalizedSearch = params.search?.trim().toUpperCase();
    const searchedSalaryType =
      normalizedSearch === SalaryType.MONTHLY ||
      normalizedSearch === SalaryType.WEEKLY
        ? normalizedSearch
        : undefined;
    const where = {
      ...(params.status && { status: params.status }),
      ...(params.role && { role: params.role }),
      ...(params.salaryType && { salaryType: params.salaryType }),
      ...(params.department && { department: params.department }),
      ...(params.search && {
        OR: [
          { name: { contains: params.search, mode: "insensitive" as const } },
          { email: { contains: params.search, mode: "insensitive" as const } },
          {
            employeeCode: {
              contains: params.search,
              mode: "insensitive" as const,
            },
          },
          {
            department: {
              contains: params.search,
              mode: "insensitive" as const,
            },
          },
          ...(searchedSalaryType ? [{ salaryType: searchedSalaryType }] : []),
        ],
      }),
    };

    return Promise.all([
      readPrisma.employee.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { createdAt: "desc" },
        select: this.defaultSelect(),
      }),
      readPrisma.employee.count({ where }),
    ]);
  }

  static options(params: { search?: string; limit: number }) {
    const search = params.search?.trim();

    return readPrisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            {
              employeeCode: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            { phone: { contains: search } },
          ],
        }),
      },
      take: Math.min(Math.max(params.limit, 1), 50),
      orderBy: [{ employeeCode: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        employeeCode: true,
        salaryType: true,
        status: true,
        role: true,
      },
    });
  }

  static update(id: string, data: any) {
    return prisma.employee.update({
      where: { id },
      data,
      select: this.defaultSelect(),
    });
  }

  static updateStatus(id: string, status: EmployeeStatus) {
    return prisma.employee.update({
      where: { id },
      data: { status },
      select: this.defaultSelect(),
    });
  }

  static updateRole(id: string, role: Role) {
    return prisma.employee.update({
      where: { id },
      data: { role },
      select: this.defaultSelect(),
    });
  }

  static defaultSelect() {
    return {
      id: true,
      employeeCode: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      designation: true,
      department: true,
      joiningDate: true,
      salaryType: true,
      status: true,
      role: true,
      profileImage: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
