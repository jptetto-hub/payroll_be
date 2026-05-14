"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerRepository = void 0;
const prisma_1 = require("../../config/prisma");
class LedgerRepository {
    static async getLastBalance(employeeId) {
        const last = await prisma_1.prisma.ledgerEntry.findFirst({
            where: { employeeId },
            orderBy: { createdAt: "desc" },
        });
        return last ? Number(last.balance) : 0;
    }
    static create(data) {
        return prisma_1.prisma.ledgerEntry.create({
            data,
        });
    }
    static listAll(params) {
        const where = {
            ...(params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.payrollId && { payrollId: params.payrollId }),
            ...(params.type && { type: params.type }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.ledgerEntry.findMany({
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
                            salaryType: true,
                        },
                    },
                    payroll: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.ledgerEntry.count({ where }),
        ]);
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.ledgerEntry.findMany({
            where: { employeeId },
            include: {
                payroll: true,
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.prisma.ledgerEntry.count({
            where: { employeeId },
        });
    }
    static listByPayroll(payrollId, pagination) {
        return prisma_1.prisma.ledgerEntry.findMany({
            where: { payrollId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "asc" },
        });
    }
    static countByPayroll(payrollId) {
        return prisma_1.prisma.ledgerEntry.count({
            where: { payrollId },
        });
    }
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                role: true,
                status: true,
            },
        });
    }
    static findPayroll(payrollId) {
        return prisma_1.prisma.payroll.findUnique({
            where: { id: payrollId },
            include: {
                employee: {
                    select: {
                        id: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });
    }
}
exports.LedgerRepository = LedgerRepository;
//# sourceMappingURL=ledger.repository.js.map