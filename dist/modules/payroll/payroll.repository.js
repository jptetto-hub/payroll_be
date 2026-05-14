"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class PayrollRepository {
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                role: true,
                status: true,
                salaryType: true,
                joiningDate: true,
            },
        });
    }
    static getSystemSetting() {
        return prisma_1.prisma.systemSetting.findFirst();
    }
    static findActivePayroll(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart,
                periodEnd,
                status: {
                    in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
                },
            },
        });
    }
    static getLatestVersion(employeeId, periodStart, periodEnd) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart,
                periodEnd,
            },
            orderBy: {
                version: "desc",
            },
        });
    }
    static createPayroll(data) {
        return prisma_1.prisma.payroll.create({
            data,
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        salaryType: true,
                    },
                },
            },
        });
    }
    static list(params) {
        const where = {
            ...(params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.status && { status: params.status }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.payroll.findMany({
                where,
                skip: params.skip,
                take: params.take,
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                            phone: true,
                            department: true,
                            designation: true,
                            salaryType: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.payroll.count({ where }),
        ]);
    }
    static findById(id) {
        return prisma_1.prisma.payroll.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
                payslips: true,
                ledgerEntries: true,
            },
        });
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.payroll.findMany({
            where: { employeeId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.prisma.payroll.count({
            where: { employeeId },
        });
    }
    static updateStatus(id, status) {
        return prisma_1.prisma.payroll.update({
            where: { id },
            data: { status },
        });
    }
    static cancelPayroll(id) {
        return prisma_1.prisma.payroll.update({
            where: { id },
            data: {
                status: client_1.PayrollStatus.CANCELLED,
            },
        });
    }
    static recalculatePayroll(params) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const oldPayroll = await tx.payroll.update({
                where: { id: params.oldPayrollId },
                data: {
                    status: client_1.PayrollStatus.SUPERSEDED,
                },
            });
            const newPayroll = await tx.payroll.create({
                data: params.newPayrollData,
                include: {
                    employee: {
                        select: {
                            id: true,
                            employeeCode: true,
                            name: true,
                            salaryType: true,
                        },
                    },
                },
            });
            return {
                oldPayroll,
                newPayroll,
            };
        });
    }
}
exports.PayrollRepository = PayrollRepository;
//# sourceMappingURL=payroll.repository.js.map