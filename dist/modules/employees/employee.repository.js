"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmployeeRepository = void 0;
const prisma_1 = require("../../config/prisma");
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
        return prisma_1.prisma.employee.findUnique({
            where: { id },
            select: this.defaultSelect(),
        });
    }
    static countEmployees() {
        return prisma_1.prisma.employee.count();
    }
    static list(params) {
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
                ],
            }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.employee.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: { createdAt: "desc" },
                select: this.defaultSelect(),
            }),
            prisma_1.prisma.employee.count({ where }),
        ]);
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