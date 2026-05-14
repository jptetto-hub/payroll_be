"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryHistoryRepository = void 0;
const prisma_1 = require("../../config/prisma");
class SalaryHistoryRepository {
    static create(data) {
        return prisma_1.prisma.salaryHistory.create({ data });
    }
    static findById(id) {
        return prisma_1.prisma.salaryHistory.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        name: true,
                        salaryType: true,
                        status: true,
                        joiningDate: true,
                    },
                },
            },
        });
    }
    static findEmployee(employeeId) {
        return prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                salaryType: true,
                status: true,
                joiningDate: true,
            },
        });
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.salaryHistory.findMany({
            where: { employeeId },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { effectiveFrom: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return prisma_1.prisma.salaryHistory.count({
            where: { employeeId },
        });
    }
    static findByEmployeeAndEffectiveDate(employeeId, effectiveFrom) {
        return prisma_1.prisma.salaryHistory.findFirst({
            where: {
                employeeId,
                effectiveFrom,
            },
        });
    }
    static getCurrentSalary(employeeId) {
        return prisma_1.prisma.salaryHistory.findFirst({
            where: {
                employeeId,
                effectiveFrom: {
                    lte: new Date(),
                },
            },
            orderBy: {
                effectiveFrom: "desc",
            },
        });
    }
    static resolveSalaryByDate(employeeId, date) {
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
    static update(id, data) {
        return prisma_1.prisma.salaryHistory.update({
            where: { id },
            data,
        });
    }
    static delete(id) {
        return prisma_1.prisma.salaryHistory.delete({
            where: { id },
        });
    }
    static findPayrollUsingSalaryPeriod(employeeId, effectiveFrom) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                periodStart: {
                    lte: effectiveFrom,
                },
                periodEnd: {
                    gte: effectiveFrom,
                },
            },
        });
    }
}
exports.SalaryHistoryRepository = SalaryHistoryRepository;
//# sourceMappingURL=salary-history.repository.js.map