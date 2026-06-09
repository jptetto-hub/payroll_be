"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const cache_1 = require("../../utils/cache");
const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
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
    static countActiveEmployees(salaryTypes) {
        return prisma_1.prisma.employee.count({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
                ...(salaryTypes?.length
                    ? {
                        salaryType: {
                            in: salaryTypes,
                        },
                    }
                    : {}),
            },
        });
    }
    static countPendingActiveEmployees(targetPeriods) {
        return prisma_1.prisma.employee.count({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
                OR: targetPeriods.map((period) => ({
                    salaryType: period.salaryType,
                    payrolls: {
                        none: {
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                        },
                    },
                })),
            },
        });
    }
    static getPendingActiveEmployeesBatch(params) {
        return prisma_1.prisma.employee.findMany({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
                ...(params.cursor ? { id: { gt: params.cursor } } : {}),
                OR: params.targetPeriods.map((period) => ({
                    salaryType: period.salaryType,
                    payrolls: {
                        none: {
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                        },
                    },
                })),
            },
            take: params.take,
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
                id: "asc",
            },
        });
    }
    static getHandledActiveEmployeesBatch(params) {
        return prisma_1.prisma.employee.findMany({
            where: {
                status: client_1.EmployeeStatus.ACTIVE,
                ...(params.cursor ? { id: { gt: params.cursor } } : {}),
                OR: params.targetPeriods.map((period) => ({
                    salaryType: period.salaryType,
                    payrolls: {
                        some: {
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                        },
                    },
                })),
            },
            take: params.take,
            select: {
                id: true,
                employeeCode: true,
                salaryType: true,
                payrolls: {
                    where: {
                        OR: params.targetPeriods.map((period) => ({
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                        })),
                    },
                    select: {
                        id: true,
                        periodStart: true,
                        periodEnd: true,
                        status: true,
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
            orderBy: {
                id: "asc",
            },
        });
    }
    static async findManualAdvanceReminderEmployees(targetPeriods) {
        const result = [];
        for (const period of targetPeriods) {
            const employees = await prisma_1.prisma.employee.findMany({
                where: {
                    status: client_1.EmployeeStatus.ACTIVE,
                    salaryType: period.salaryType,
                    advanceDeductionMode: client_1.AdvanceDeductionMode.MANUAL,
                    advances: {
                        some: {
                            date: {
                                lte: period.periodEnd,
                            },
                            isSettled: false,
                            remainingAmount: {
                                gt: 0,
                            },
                        },
                    },
                    advanceManualDeductions: {
                        none: {
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                        },
                    },
                    payrolls: {
                        none: {
                            periodStart: period.periodStart,
                            periodEnd: period.periodEnd,
                            status: {
                                in: [client_1.PayrollStatus.GENERATED, client_1.PayrollStatus.PAID],
                            },
                        },
                    },
                },
                select: {
                    id: true,
                    employeeCode: true,
                    name: true,
                    salaryType: true,
                    advances: {
                        where: {
                            date: {
                                lte: period.periodEnd,
                            },
                            isSettled: false,
                            remainingAmount: {
                                gt: 0,
                            },
                        },
                        select: {
                            id: true,
                            remainingAmount: true,
                            date: true,
                        },
                        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
                    },
                },
                orderBy: {
                    employeeCode: "asc",
                },
            });
            result.push(...employees.map((employee) => ({
                ...employee,
                periodStart: period.periodStart,
                periodEnd: period.periodEnd,
            })));
        }
        return result;
    }
    static async getSystemSetting() {
        const cached = await cache_1.CacheService.get(SYSTEM_SETTINGS_CACHE_KEY);
        if (cached) {
            return cached;
        }
        const setting = await prisma_1.prisma.systemSetting.findFirst();
        await cache_1.CacheService.set(SYSTEM_SETTINGS_CACHE_KEY, setting, SETTINGS_CACHE_TTL);
        return setting;
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
    static async getFirstSalaryHistories(employeeIds) {
        if (employeeIds.length === 0) {
            return new Map();
        }
        const salaryHistories = await prisma_1.prisma.$queryRaw `
      SELECT DISTINCT ON ("employeeId")
        id,
        "employeeId",
        "salaryAmount",
        "effectiveFrom"
      FROM "SalaryHistory"
      WHERE "employeeId" IN (${client_1.Prisma.join(employeeIds)})
      ORDER BY "employeeId", "effectiveFrom" ASC
    `;
        const firstSalaryMap = new Map();
        for (const salary of salaryHistories) {
            if (!firstSalaryMap.has(salary.employeeId)) {
                firstSalaryMap.set(salary.employeeId, salary);
            }
        }
        return firstSalaryMap;
    }
    static createRun(data) {
        return prisma_1.prisma.schedulerRun.create({
            data,
        });
    }
    static findActiveRunByName(name) {
        return prisma_1.prisma.schedulerRun.findFirst({
            where: {
                name,
                status: {
                    in: [client_1.SchedulerRunStatus.PENDING, client_1.SchedulerRunStatus.RUNNING],
                },
            },
            select: {
                id: true,
                status: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    static findActiveSinglePayrollRun(params) {
        return prisma_1.prisma.schedulerRun.findFirst({
            where: {
                name: "MANUAL_SINGLE_PAYROLL_GENERATION",
                status: {
                    in: [client_1.SchedulerRunStatus.PENDING, client_1.SchedulerRunStatus.RUNNING],
                },
                AND: [
                    {
                        metadata: {
                            path: ["employeeId"],
                            equals: params.employeeId,
                        },
                    },
                    {
                        metadata: {
                            path: ["periodStart"],
                            equals: params.periodStart,
                        },
                    },
                    {
                        metadata: {
                            path: ["periodEnd"],
                            equals: params.periodEnd,
                        },
                    },
                ],
            },
            select: {
                id: true,
                status: true,
            },
            orderBy: {
                createdAt: "desc",
            },
        });
    }
    static markStaleActiveRunsFailed(params) {
        return prisma_1.prisma.schedulerRun.updateMany({
            where: {
                status: {
                    in: [client_1.SchedulerRunStatus.PENDING, client_1.SchedulerRunStatus.RUNNING],
                },
                updatedAt: {
                    lt: params.staleBefore,
                },
            },
            data: {
                status: client_1.SchedulerRunStatus.FAILED,
                completedAt: new Date(),
                errorMessage: params.errorMessage,
            },
        });
    }
    static updateRun(id, data) {
        return prisma_1.prisma.schedulerRun.update({
            where: { id },
            data,
        });
    }
    static createRunItem(data) {
        return prisma_1.prisma.schedulerRunItem.create({
            data: {
                runId: data.runId,
                employeeId: data.employeeId ?? null,
                employeeCode: data.employeeCode ?? null,
                periodStart: data.periodStart ?? null,
                periodEnd: data.periodEnd ?? null,
                status: data.status,
                reason: data.reason ?? null,
                errorMessage: data.errorMessage ?? null,
                payrollId: data.payrollId ?? null,
            },
        });
    }
    static createRunItems(items) {
        if (items.length === 0) {
            return { count: 0 };
        }
        return prisma_1.prisma.schedulerRunItem.createMany({
            data: items.map((item) => ({
                runId: item.runId,
                employeeId: item.employeeId ?? null,
                employeeCode: item.employeeCode ?? null,
                periodStart: item.periodStart ?? null,
                periodEnd: item.periodEnd ?? null,
                status: item.status,
                reason: item.reason ?? null,
                errorMessage: item.errorMessage ?? null,
                payrollId: item.payrollId ?? null,
            })),
        });
    }
    static listRuns(params) {
        return Promise.all([
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
    static listRunItems(params) {
        const where = {
            runId: params.runId,
            ...(params.status && { status: params.status }),
        };
        return Promise.all([
            prisma_1.prisma.schedulerRunItem.findMany({
                where,
                skip: params.skip,
                take: params.take,
                orderBy: {
                    createdAt: "desc",
                },
                select: {
                    id: true,
                    runId: true,
                    employeeId: true,
                    employeeCode: true,
                    periodStart: true,
                    periodEnd: true,
                    status: true,
                    payrollId: true,
                    reason: true,
                    errorMessage: true,
                    createdAt: true,
                },
            }),
            prisma_1.prisma.schedulerRunItem.count({ where }),
        ]);
    }
    static findRunById(id) {
        return prisma_1.prisma.schedulerRun.findUnique({
            where: { id },
            select: {
                id: true,
                name: true,
                status: true,
                totalEmployees: true,
                processedEmployees: true,
                successCount: true,
                skippedCount: true,
                failedCount: true,
                startedAt: true,
                completedAt: true,
                errorMessage: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }
}
exports.SchedulerRepository = SchedulerRepository;
//# sourceMappingURL=scheduler.repository.js.map