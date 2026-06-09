"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollRepository = void 0;
const prisma_1 = require("../../config/prisma");
const client_1 = require("@prisma/client");
const cache_1 = require("../../utils/cache");
const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
const payrollListSelect = {
    id: true,
    employeeId: true,
    periodStart: true,
    periodEnd: true,
    salaryType: true,
    grossSalary: true,
    standardSalary: true,
    otTotalHours: true,
    otEarnings: true,
    advanceDeduction: true,
    finalSalary: true,
    version: true,
    status: true,
    isRecalculated: true,
    createdAt: true,
    employee: {
        select: {
            id: true,
            employeeCode: true,
            name: true,
            department: true,
            designation: true,
            salaryType: true,
        },
    },
};
const buildDateRange = (search) => {
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(search);
    const parsed = dateOnlyMatch
        ? new Date(`${search}T00:00:00.000Z`)
        : new Date(search);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }
    const start = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999));
    return { gte: start, lte: end };
};
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
                advanceDeductionMode: true,
                joiningDate: true,
            },
        });
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
    static findByActivePayrollKey(activePayrollKey) {
        return prisma_1.prisma.payroll.findUnique({
            where: {
                activePayrollKey,
            },
            select: {
                id: true,
                status: true,
                version: true,
                periodStart: true,
                periodEnd: true,
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
        const search = params.search?.trim();
        const normalizedSearch = search?.toUpperCase();
        const numericSearch = search && /^-?\d+(\.\d+)?$/.test(search) ? Number(search) : undefined;
        const integerSearch = numericSearch !== undefined && Number.isInteger(numericSearch)
            ? numericSearch
            : undefined;
        const dateRange = search ? buildDateRange(search) : undefined;
        const searchFilters = search
            ? [
                { id: { contains: search, mode: "insensitive" } },
                { employeeId: { contains: search, mode: "insensitive" } },
                { activePayrollKey: { contains: search, mode: "insensitive" } },
                { recalculatedBy: { contains: search, mode: "insensitive" } },
                {
                    recalculationReason: { contains: search, mode: "insensitive" },
                },
                { replacedPayrollId: { contains: search, mode: "insensitive" } },
                { cancelledById: { contains: search, mode: "insensitive" } },
                { cancelReason: { contains: search, mode: "insensitive" } },
                {
                    employee: {
                        name: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    employee: {
                        employeeCode: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    employee: {
                        department: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    employee: {
                        designation: { contains: search, mode: "insensitive" },
                    },
                },
                {
                    employee: {
                        phone: { contains: search },
                    },
                },
            ]
            : [];
        if (normalizedSearch === "MONTHLY" || normalizedSearch === "WEEKLY") {
            searchFilters.push({ salaryType: normalizedSearch });
        }
        if (normalizedSearch === "GENERATED" ||
            normalizedSearch === "PAID" ||
            normalizedSearch === "SUPERSEDED" ||
            normalizedSearch === "CANCELLED") {
            searchFilters.push({ status: normalizedSearch });
        }
        if (normalizedSearch === "TRUE" || normalizedSearch === "FALSE") {
            searchFilters.push({ isRecalculated: normalizedSearch === "TRUE" });
        }
        if (integerSearch !== undefined) {
            searchFilters.push({ version: integerSearch }, { totalDays: integerSearch }, { workingDays: integerSearch });
        }
        if (numericSearch !== undefined) {
            searchFilters.push({ grossSalary: numericSearch }, { standardSalary: numericSearch }, { otTotalHours: numericSearch }, { otHourlyRate: numericSearch }, { otEarnings: numericSearch }, { advanceDeduction: numericSearch }, { carryForwardApplied: numericSearch }, { totalDeduction: numericSearch }, { rawFinalSalary: numericSearch }, { carryForwardDeduction: numericSearch }, { finalSalary: numericSearch }, { presentDays: numericSearch }, { absentDays: numericSearch }, { halfDays: numericSearch });
        }
        if (dateRange) {
            searchFilters.push({ periodStart: dateRange }, { periodEnd: dateRange }, { recalculatedAt: dateRange }, { lockedAt: dateRange }, { cancelledAt: dateRange }, { createdAt: dateRange }, { updatedAt: dateRange });
        }
        const where = {
            ...(params.employeeId
                ? { employeeId: params.employeeId }
                : params.employeeWhere && { employee: params.employeeWhere }),
            ...(params.status && { status: params.status }),
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
            ...(search && {
                OR: searchFilters,
            }),
        };
        return prisma_1.readPrisma.payroll.findMany({
            where,
            take: params.take,
            ...(params.cursor
                ? {
                    skip: 1,
                    cursor: { id: params.cursor },
                }
                : {}),
            orderBy: { createdAt: "desc" },
            select: payrollListSelect,
        });
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
                        joiningDate: true,
                    },
                },
                payslips: true,
                ledgerEntries: true,
            },
        });
    }
    static findByIdForRead(id) {
        return prisma_1.readPrisma.payroll.findUnique({
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
                        joiningDate: true,
                    },
                },
                payslips: true,
                ledgerEntries: true,
            },
        });
    }
    static listByEmployee(employeeId, pagination, filters) {
        return prisma_1.readPrisma.payroll.findMany({
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
            },
            ...(pagination && {
                skip: pagination.skip,
                take: pagination.take,
            }),
            orderBy: { createdAt: "desc" },
            select: payrollListSelect,
        });
    }
    static countByEmployee(employeeId, filters) {
        return prisma_1.readPrisma.payroll.count({
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
            },
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
                    activePayrollKey: null,
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
            const appliedState = params.applyState
                ? await params.applyState(tx, { oldPayroll, newPayroll })
                : undefined;
            return {
                oldPayroll,
                newPayroll,
                ...(appliedState ?? {}),
            };
        });
    }
}
exports.PayrollRepository = PayrollRepository;
//# sourceMappingURL=payroll.repository.js.map