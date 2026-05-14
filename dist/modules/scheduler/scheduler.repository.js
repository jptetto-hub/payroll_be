"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class SchedulerRepository {
    static getActiveEmployees() {
        return prisma_1.prisma.employee.findMany({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
            },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                salaryType: true,
                joiningDate: true,
                role: true,
                status: true,
            },
            orderBy: {
                employeeCode: "asc",
            },
        });
    }
    static getSystemSetting() {
        return prisma_1.prisma.systemSetting.findFirst();
    }
    static findPayroll(employeeId, periodStart, periodEnd) {
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
    static getLatestPayroll(employeeId) {
        return prisma_1.prisma.payroll.findFirst({
            where: {
                employeeId,
                status: {
                    in: [
                        client_1.PayrollStatus.GENERATED,
                        client_1.PayrollStatus.PAID,
                        client_1.PayrollStatus.SUPERSEDED,
                    ],
                },
            },
            orderBy: {
                periodEnd: "desc",
            },
        });
    }
    static getFirstSalaryHistory(employeeId) {
        return prisma_1.prisma.salaryHistory.findFirst({
            where: {
                employeeId,
            },
            orderBy: {
                effectiveFrom: "asc",
            },
        });
    }
    static createRun(data) {
        return prisma_1.prisma.schedulerRun.create({
            data,
        });
    }
    static updateRun(id, data) {
        return prisma_1.prisma.schedulerRun.update({
            where: { id },
            data,
        });
    }
    static listRuns(params) {
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.schedulerRun.findMany({
                skip: params.skip,
                take: params.take,
                orderBy: {
                    createdAt: "desc",
                },
            }),
            prisma_1.prisma.schedulerRun.count(),
        ]);
    }
}
exports.SchedulerRepository = SchedulerRepository;
//# sourceMappingURL=scheduler.repository.js.map