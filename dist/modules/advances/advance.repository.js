"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdvanceRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class AdvanceRepository {
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
    static create(data) {
        return prisma_1.prisma.advancePayment.create({
            data,
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
        });
    }
    static findById(id) {
        return prisma_1.prisma.advancePayment.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        role: true,
                        status: true,
                        salaryType: true,
                        joiningDate: true,
                    },
                },
            },
        });
    }
    static listAll(params) {
        const where = {
            ...(params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.isSettled !== undefined && { isSettled: params.isSettled }),
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.advancePayment.findMany({
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
            prisma_1.prisma.advancePayment.count({ where }),
        ]);
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.advancePayment.findMany({
            where: { employeeId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { date: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.prisma.advancePayment.count({
            where: { employeeId },
        });
    }
    static listByCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
            },
            orderBy: { date: "asc" },
        });
    }
    static findPayrollForCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart: cycleStartDate,
                periodEnd: cycleEndDate,
            },
        });
    }
    static update(id, data) {
        return prisma_1.prisma.advancePayment.update({
            where: { id },
            data,
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
        });
    }
    static delete(id) {
        return prisma_1.prisma.advancePayment.delete({
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
            },
        });
    }
    static getSalaryForDate(employeeId, date) {
        return prisma_1.prisma.salaryHistory.findFirst({
            where: {
                employeeId,
                effectiveFrom: {
                    lte: date,
                },
            },
            orderBy: {
                effectiveFrom: "desc",
            },
        });
    }
    static getAdvancesForCycle(employeeId, cycleStartDate, cycleEndDate, excludeAdvanceId) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
                isSettled: false,
                ...(excludeAdvanceId && {
                    id: {
                        not: excludeAdvanceId,
                    },
                }),
            },
        });
    }
    static getUnsettledAdvancesForCycle(employeeId, cycleStartDate, cycleEndDate) {
        return prisma_1.prisma.advancePayment.findMany({
            where: {
                employeeId,
                cycleStartDate,
                cycleEndDate,
                isSettled: false,
            },
            orderBy: { date: "asc" },
        });
    }
    static settleAdvances(ids) {
        return prisma_1.prisma.$transaction(async (tx) => {
            const advances = await tx.advancePayment.findMany({
                where: {
                    id: {
                        in: ids,
                    },
                },
            });
            await Promise.all(advances.map((advance) => tx.advancePayment.update({
                where: { id: advance.id },
                data: {
                    settledAmount: advance.amount,
                    remainingAmount: 0,
                    carryForwardAmount: 0,
                    settlementStatus: client_1.AdvanceSettlementStatus.SETTLED,
                    isSettled: true,
                },
            })));
            return {
                count: advances.length,
            };
        });
    }
}
exports.AdvanceRepository = AdvanceRepository;
//# sourceMappingURL=advance.repository.js.map