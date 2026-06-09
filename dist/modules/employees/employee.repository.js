"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class EmployeeRepository {
    static create(data) {
        return prisma_1.prisma.employee.create({
            data,
            select: this.defaultSelect(),
        });
    }
    static findByEmail(email) {
        return prisma_1.prisma.employee.findUnique({ where: { email } });
    }
    static findByPhone(phone) {
        return prisma_1.prisma.employee.findUnique({ where: { phone } });
    }
    static findById(id) {
        return prisma_1.readPrisma.employee.findUnique({
            where: { id },
            select: this.defaultSelect(),
        });
    }
    static countEmployees() {
        return prisma_1.readPrisma.employee.count();
    }
    static list(params) {
        const normalizedSearch = params.search?.trim().toUpperCase();
        const searchedSalaryType = normalizedSearch === client_1.SalaryType.MONTHLY ||
            normalizedSearch === client_1.SalaryType.WEEKLY
            ? normalizedSearch
            : undefined;
        const where = {
            ...(params.status && { status: params.status }),
            ...(params.role && { role: params.role }),
            ...(params.salaryType && { salaryType: params.salaryType }),
            ...(params.department && { department: params.department }),
            ...(params.search && {
                OR: [
                    { name: { contains: params.search, mode: "insensitive" } },
                    { email: { contains: params.search, mode: "insensitive" } },
                    {
                        employeeCode: {
                            contains: params.search,
                            mode: "insensitive",
                        },
                    },
                    {
                        department: {
                            contains: params.search,
                            mode: "insensitive",
                        },
                    },
                    ...(searchedSalaryType ? [{ salaryType: searchedSalaryType }] : []),
                ],
            }),
        };
        return Promise.all([
            prisma_1.readPrisma.employee.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: "desc" },
                select: this.defaultSelect(),
            }),
            prisma_1.readPrisma.employee.count({ where }),
        ]);
    }
    static options(params) {
        const search = params.search?.trim();
        return prisma_1.readPrisma.employee.findMany({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        {
                            employeeCode: {
                                contains: search,
                                mode: "insensitive",
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
                advanceDeductionMode: true,
                status: true,
                role: true,
            },
        });
    }
    static update(id, data) {
        return prisma_1.prisma.employee.update({
            where: { id },
            data,
            select: this.defaultSelect(),
        });
    }
    static updateStatus(id, status) {
        return prisma_1.prisma.employee.update({
            where: { id },
            data: { status },
            select: this.defaultSelect(),
        });
    }
    static updateRole(id, role) {
        return prisma_1.prisma.employee.update({
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
            advanceDeductionMode: true,
            status: true,
            role: true,
            profileImage: true,
            createdAt: true,
            updatedAt: true,
        };
    }
}
exports.EmployeeRepository = EmployeeRepository;
//# sourceMappingURL=employee.repository.js.map