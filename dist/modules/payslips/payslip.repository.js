"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayslipRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
class PayslipRepository {
    static findPayroll(payrollId) {
        return prisma_1.prisma.payroll.findUnique({
            where: { id: payrollId },
            include: {
                employee: {
                    select: {
                        id: true,
                        role: true,
                        status: true,
                        employeeCode: true,
                        name: true,
                        salaryType: true,
                    },
                },
            },
        });
    }
    static findByPayroll(payrollId) {
        return prisma_1.prisma.payslip.findFirst({
            where: { payrollId },
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
    static createFromPayroll(payroll) {
        return prisma_1.prisma.payslip.create({
            data: {
                employeeId: payroll.employeeId,
                payrollId: payroll.id,
                periodStart: payroll.periodStart,
                periodEnd: payroll.periodEnd,
                totalDays: payroll.totalDays,
                presentDays: payroll.presentDays,
                absentDays: payroll.absentDays,
                halfDays: payroll.halfDays,
                salaryBreakdown: payroll.salaryBreakdown,
                standardSalary: payroll.standardSalary ?? payroll.grossSalary,
                otTotalHours: payroll.otTotalHours ?? 0,
                otHourlyRate: payroll.otHourlyRate ?? 0,
                otEarnings: payroll.otEarnings ?? 0,
                overtimeBreakdown: payroll.overtimeBreakdown ?? null,
                advanceDeduction: payroll.advanceDeduction,
                finalSalary: payroll.finalSalary,
                payrollVersion: payroll.version,
                isRecalculated: payroll.isRecalculated,
            },
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
            },
        });
    }
    static listAll(params) {
        const where = {
            ...(params.employeeWhere && { employee: params.employeeWhere }),
            payroll: {
                is: {
                    status: {
                        not: client_1.PayrollStatus.CANCELLED,
                    },
                },
            },
        };
        return prisma_1.prisma.$transaction([
            prisma_1.prisma.payslip.findMany({
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
                    payroll: true,
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.prisma.payslip.count({ where }),
        ]);
    }
    static findById(id) {
        return prisma_1.prisma.payslip.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        role: true,
                        employeeCode: true,
                        name: true,
                        phone: true,
                        department: true,
                        designation: true,
                        salaryType: true,
                    },
                },
                payroll: true,
            },
        });
    }
    static listByEmployee(employeeId, pagination) {
        return prisma_1.prisma.payslip.findMany({
            where: {
                employeeId,
                payroll: {
                    is: {
                        status: {
                            not: client_1.PayrollStatus.CANCELLED,
                        },
                    },
                },
            },
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
        return prisma_1.prisma.payslip.count({
            where: {
                employeeId,
                payroll: {
                    is: {
                        status: {
                            not: client_1.PayrollStatus.CANCELLED,
                        },
                    },
                },
            },
        });
    }
}
exports.PayslipRepository = PayslipRepository;
//# sourceMappingURL=payslip.repository.js.map