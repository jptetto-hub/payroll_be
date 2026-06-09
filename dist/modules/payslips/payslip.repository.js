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
        return prisma_1.readPrisma.payslip.findUnique({
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
        return prisma_1.readPrisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                role: true,
                status: true,
            },
        });
    }
    static createFromPayroll(payroll) {
        return prisma_1.prisma.payslip.upsert({
            where: {
                payrollId: payroll.id,
            },
            update: {
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
                status: client_1.PayslipStatus.READY,
                pdfGeneratedAt: new Date(),
                errorMessage: null,
            },
            create: {
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
                status: client_1.PayslipStatus.READY,
                pdfGeneratedAt: new Date(),
                errorMessage: null,
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
    static findRetryTarget(id) {
        return prisma_1.prisma.payslip.findUnique({
            where: { id },
            select: {
                id: true,
                payrollId: true,
                status: true,
            },
        });
    }
    static markRetryQueued(id) {
        return prisma_1.prisma.payslip.update({
            where: { id },
            data: {
                status: client_1.PayslipStatus.PENDING,
                errorMessage: null,
            },
        });
    }
    static listAll(params) {
        const where = {
            ...(params.employeeId
                ? { employeeId: params.employeeId }
                : params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.from && {
                periodStart: {
                    gte: params.from,
                },
            }),
            ...(params.to && {
                periodEnd: {
                    lte: params.to,
                },
            }),
            payroll: {
                is: {
                    status: {
                        not: client_1.PayrollStatus.CANCELLED,
                    },
                },
            },
        };
        return Promise.all([
            prisma_1.readPrisma.payslip.findMany({
                where,
                skip: params.skip,
                take: params.take,
                select: {
                    id: true,
                    employeeId: true,
                    payrollId: true,
                    periodStart: true,
                    periodEnd: true,
                    totalDays: true,
                    presentDays: true,
                    absentDays: true,
                    halfDays: true,
                    standardSalary: true,
                    otTotalHours: true,
                    otEarnings: true,
                    advanceDeduction: true,
                    finalSalary: true,
                    payrollVersion: true,
                    isRecalculated: true,
                    status: true,
                    pdfUrl: true,
                    pdfGeneratedAt: true,
                    createdAt: true,
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
                    payroll: {
                        select: {
                            id: true,
                            status: true,
                            salaryType: true,
                            periodStart: true,
                            periodEnd: true,
                            version: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            }),
            prisma_1.readPrisma.payslip.count({ where }),
        ]);
    }
    static findById(id) {
        return prisma_1.readPrisma.payslip.findUnique({
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
    static listByEmployee(employeeId, pagination, filters) {
        return prisma_1.readPrisma.payslip.findMany({
            where: {
                employeeId,
                ...(filters?.from && {
                    periodStart: {
                        gte: filters.from,
                    },
                }),
                ...(filters?.to && {
                    periodEnd: {
                        lte: filters.to,
                    },
                }),
                payroll: {
                    is: {
                        status: {
                            not: client_1.PayrollStatus.CANCELLED,
                        },
                    },
                },
            },
            select: {
                id: true,
                employeeId: true,
                payrollId: true,
                periodStart: true,
                periodEnd: true,
                totalDays: true,
                presentDays: true,
                absentDays: true,
                halfDays: true,
                standardSalary: true,
                otTotalHours: true,
                otEarnings: true,
                advanceDeduction: true,
                finalSalary: true,
                payrollVersion: true,
                isRecalculated: true,
                status: true,
                pdfUrl: true,
                pdfGeneratedAt: true,
                createdAt: true,
                payroll: {
                    select: {
                        id: true,
                        status: true,
                        salaryType: true,
                        periodStart: true,
                        periodEnd: true,
                        version: true,
                    },
                },
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
        });
    }
    static countByEmployee(employeeId) {
        return this.countByEmployeeWithFilters(employeeId);
    }
    static countByEmployeeWithFilters(employeeId, filters) {
        return prisma_1.readPrisma.payslip.count({
            where: {
                employeeId,
                ...(filters?.from && {
                    periodStart: {
                        gte: filters.from,
                    },
                }),
                ...(filters?.to && {
                    periodEnd: {
                        lte: filters.to,
                    },
                }),
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