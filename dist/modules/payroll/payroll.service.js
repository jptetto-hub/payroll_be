"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollService = void 0;
const client_1 = require("@prisma/client");
const payroll_repository_1 = require("./payroll.repository");
const salary_calculation_service_1 = require("../salary-calculation/salary-calculation.service");
const payslip_service_1 = require("../payslips/payslip.service");
const payslip_queue_1 = require("../../jobs/payslip.queue");
const ledger_service_1 = require("../ledger/ledger.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const prisma_1 = require("../../config/prisma");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cursor_pagination_util_1 = require("../../shared/utils/cursor-pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payrollCycle_utils_1 = require("../../shared/payroll/payrollCycle.utils");
const app_error_1 = require("../../shared/utils/app-error");
const performanceTimer_1 = require("../../utils/performanceTimer");
const payrollKey_1 = require("../../utils/payrollKey");
const cache_1 = require("../../utils/cache");
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const PAYROLL_READ_CACHE_PREFIX = "payroll-read";
const PAYROLL_READ_CACHE_TTL = 30;
const invalidatePayrollReadCaches = (employeeId) => {
    void Promise.all([
        cache_1.CacheService.delByPattern(`${PAYROLL_READ_CACHE_PREFIX}:*`),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
        cache_1.CacheService.delByPattern("advance-read:*"),
        cache_1.CacheService.delByPattern("attendance-read:*"),
        ...(employeeId
            ? [
                cache_1.CacheService.delByPattern(`salary-history-read:${employeeId}:*`),
            ]
            : []),
    ]);
    ledger_service_1.LedgerService.invalidateReadCaches();
};
const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
};
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
const getMonthStart = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};
const getMonthEnd = (date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};
const isSameDate = (a, b) => formatDate(a) === formatDate(b);
const getAttendanceLockStart = (params) => {
    if (params.salaryType !== client_1.SalaryType.WEEKLY ||
        params.periodStart.getUTCDay() !== 1) {
        return params.periodStart;
    }
    const precedingSunday = addDays(params.periodStart, -1);
    return precedingSunday >= params.joiningDate
        ? precedingSunday
        : params.periodStart;
};
const buildAdvanceBreakdown = (advanceSummary, carryForwardSummary) => {
    const advances = advanceSummary.advances ?? [];
    return {
        ...advanceSummary,
        carryForwardApplied: carryForwardSummary,
        advances: advances.map((advance) => {
            const { __restoreBeforeSettlement, __previousSettledAmount, ...snapshotAdvance } = advance;
            return {
                ...snapshotAdvance,
                deductedAmount: Number(advance.__deductedAmount ?? advance.remainingAmount),
                previousRemainingAmount: advance.remainingAmount,
                previousSettledAmount: advance.settledAmount ?? 0,
                previousCarryForwardAmount: advance.carryForwardAmount ?? 0,
                previousSettlementStatus: advance.settlementStatus ?? client_1.AdvanceSettlementStatus.UNSETTLED,
                previousIsSettled: advance.isSettled,
            };
        }),
    };
};
const settleAdvancesForPayroll = async (tx, calculation, payrollId) => {
    let availableForAdvance = Number(calculation.result.grossSalary);
    const settledAdvances = [];
    for (const advance of calculation.advanceSummary.advances) {
        const remainingAmount = Number(advance.remainingAmount);
        const requestedSettlement = Number(advance.__deductedAmount ?? remainingAmount);
        const settledAmount = roundMoney(Math.min(remainingAmount, requestedSettlement, availableForAdvance));
        const newRemaining = roundMoney(remainingAmount - settledAmount);
        const restoreBeforeSettlement = Boolean(advance.__restoreBeforeSettlement);
        const previousSettledAmount = Number(advance.__previousSettledAmount ?? 0);
        const updatedAdvance = await tx.advancePayment.update({
            where: { id: advance.id },
            data: {
                settledAmount: restoreBeforeSettlement
                    ? roundMoney(previousSettledAmount + settledAmount)
                    : {
                        increment: settledAmount,
                    },
                remainingAmount: newRemaining,
                isSettled: newRemaining <= 0,
                settlementStatus: newRemaining <= 0
                    ? client_1.AdvanceSettlementStatus.SETTLED
                    : settledAmount > 0
                        ? client_1.AdvanceSettlementStatus.PARTIALLY_SETTLED
                        : client_1.AdvanceSettlementStatus.UNSETTLED,
                carryForwardAmount: newRemaining,
                lockedByPayrollId: payrollId,
            },
        });
        settledAdvances.push(updatedAdvance);
        availableForAdvance = roundMoney(availableForAdvance - settledAmount);
    }
    return settledAdvances;
};
const roundMoney = (amount) => Math.round(amount * 100) / 100;
const settleAppliedCarryForwardAdvances = async (tx, employeeId, appliedCarryForwards) => {
    const sourceAdvanceSettlements = [];
    const sourcePayrollIds = [
        ...new Set(appliedCarryForwards
            .map((carryForward) => carryForward.sourcePayrollId)
            .filter(Boolean)),
    ];
    if (sourcePayrollIds.length === 0) {
        return sourceAdvanceSettlements;
    }
    const sourceAdvances = await tx.advancePayment.findMany({
        where: {
            employeeId,
            lockedByPayrollId: {
                in: sourcePayrollIds,
            },
            remainingAmount: {
                gt: 0,
            },
        },
        orderBy: {
            date: "asc",
        },
    });
    const sourceAdvancesByPayrollId = new Map();
    for (const advance of sourceAdvances) {
        const sourcePayrollId = advance.lockedByPayrollId;
        if (!sourcePayrollId) {
            continue;
        }
        const rows = sourceAdvancesByPayrollId.get(sourcePayrollId) ?? [];
        rows.push(advance);
        sourceAdvancesByPayrollId.set(sourcePayrollId, rows);
    }
    for (const carryForward of appliedCarryForwards) {
        let amountToSettle = Number(carryForward.appliedAmount);
        if (amountToSettle <= 0) {
            continue;
        }
        for (const advance of sourceAdvancesByPayrollId.get(carryForward.sourcePayrollId) ?? []) {
            if (amountToSettle <= 0) {
                break;
            }
            const previousRemainingAmount = Number(advance.remainingAmount);
            const appliedAmount = roundMoney(Math.min(previousRemainingAmount, amountToSettle));
            const newRemainingAmount = roundMoney(previousRemainingAmount - appliedAmount);
            await tx.advancePayment.update({
                where: {
                    id: advance.id,
                },
                data: {
                    settledAmount: {
                        increment: appliedAmount,
                    },
                    remainingAmount: newRemainingAmount,
                    carryForwardAmount: newRemainingAmount,
                    isSettled: newRemainingAmount <= 0,
                    settlementStatus: newRemainingAmount <= 0
                        ? client_1.AdvanceSettlementStatus.SETTLED
                        : client_1.AdvanceSettlementStatus.PARTIALLY_SETTLED,
                },
            });
            sourceAdvanceSettlements.push({
                carryForwardId: carryForward.id,
                advanceId: advance.id,
                appliedAmount,
                previousRemainingAmount,
                previousSettledAmount: Number(advance.settledAmount),
                previousCarryForwardAmount: Number(advance.carryForwardAmount),
                previousSettlementStatus: advance.settlementStatus,
                previousIsSettled: advance.isSettled,
            });
            amountToSettle = roundMoney(amountToSettle - appliedAmount);
        }
    }
    return sourceAdvanceSettlements;
};
const MAX_PAYROLL_LIST_LIMIT = 500;
const getPayrollListCursorPagination = (query) => {
    const rawLimit = Number(query.limit ?? 50);
    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
        throw new app_error_1.AppError("limit must be a positive number", 400);
    }
    return {
        limit: Math.min(rawLimit, MAX_PAYROLL_LIST_LIMIT),
        cursor: query.cursor ? String(query.cursor) : undefined,
    };
};
const ensureEmployeeAccess = (targetRole, currentRole) => {
    if (currentRole === client_1.Role.ADMIN && targetRole !== client_1.Role.USER) {
        throw new Error("ADMIN can generate payroll only for USER employees");
    }
};
const validatePayrollPeriod = async (salaryType, periodStart, periodEnd) => {
    if (periodStart > periodEnd) {
        throw new Error("periodStart cannot be greater than periodEnd");
    }
    const setting = await payroll_repository_1.PayrollRepository.getSystemSetting();
    const weekStartsOn = setting?.weekStartsOn ?? client_1.WeekStartsOn.MONDAY;
    if (salaryType === client_1.SalaryType.MONTHLY) {
        const expectedStart = getMonthStart(periodStart);
        const expectedEnd = getMonthEnd(periodStart);
        if (!isSameDate(periodStart, expectedStart)) {
            throw new Error("Monthly payroll must start on 1st day of month");
        }
        if (!isSameDate(periodEnd, expectedEnd)) {
            throw new Error("Monthly payroll must end on last day of month");
        }
        return;
    }
    (0, payrollCycle_utils_1.validateWeeklyPayrollCycle)(periodStart, periodEnd, weekStartsOn);
};
class PayrollService {
    static async generate(data, currentUserRole, auditContext) {
        const timer = new performanceTimer_1.PerformanceTimer("PayrollService.generate");
        timer.checkpoint("start");
        const employee = await payroll_repository_1.PayrollRepository.findEmployee(data.employeeId);
        timer.checkpoint("employee fetch");
        if (!employee) {
            throw new Error("Employee not found");
        }
        if (employee.status !== "ACTIVE") {
            throw new Error("Cannot generate payroll for inactive employee");
        }
        ensureEmployeeAccess(employee.role, currentUserRole);
        const periodStart = parseDateOnly(data.periodStart);
        const periodEnd = parseDateOnly(data.periodEnd);
        await validatePayrollPeriod(employee.salaryType, periodStart, periodEnd);
        ensureDateOnOrAfterJoining({
            date: periodStart,
            joiningDate: employee.joiningDate,
            action: "Payroll period start",
        });
        const activePayrollKey = (0, payrollKey_1.buildActivePayrollKey)({
            employeeId: employee.id,
            periodStart,
            periodEnd,
        });
        const [existingActivePayroll, existingPeriodPayroll] = await Promise.all([
            payroll_repository_1.PayrollRepository.findByActivePayrollKey(activePayrollKey),
            payroll_repository_1.PayrollRepository.findActivePayroll(employee.id, periodStart, periodEnd),
        ]);
        timer.checkpoint("duplicate payroll check");
        if (existingActivePayroll || existingPeriodPayroll) {
            throw new Error("Active payroll already exists for this employee and period");
        }
        const [preview, latestVersion] = await Promise.all([
            salary_calculation_service_1.SalaryCalculationService.preview({
                employeeId: employee.id,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd,
            }, {
                employee,
                skipActivePayrollSnapshot: true,
            }),
            payroll_repository_1.PayrollRepository.getLatestVersion(employee.id, periodStart, periodEnd),
        ]);
        timer.checkpoint("salary calculation preview and payroll version fetch");
        const version = latestVersion ? latestVersion.version + 1 : 1;
        const advanceBreakdown = buildAdvanceBreakdown(preview.advanceSummary, preview.carryForwardSummary);
        timer.checkpoint("before payroll transaction");
        let payrollResult;
        try {
            payrollResult = await prisma_1.prisma.$transaction(async (tx) => {
                const payroll = await tx.payroll.create({
                    data: {
                        employeeId: employee.id,
                        periodStart,
                        periodEnd,
                        salaryType: employee.salaryType,
                        activePayrollKey,
                        grossSalary: preview.result.grossSalary,
                        standardSalary: preview.result.standardSalary,
                        otTotalHours: preview.result.otTotalHours,
                        otHourlyRate: preview.result.otHourlyRate,
                        otEarnings: preview.result.otEarnings,
                        advanceDeduction: preview.result.advanceDeduction,
                        carryForwardApplied: preview.result.carryForwardApplied,
                        totalDeduction: preview.result.totalDeduction,
                        rawFinalSalary: preview.result.rawFinalSalary,
                        finalSalary: preview.result.finalSalary,
                        carryForwardDeduction: preview.result.carryForwardDeduction,
                        totalDays: preview.attendanceSummary.workingDays,
                        workingDays: preview.attendanceSummary.workingDays,
                        presentDays: preview.attendanceSummary.presentDays,
                        absentDays: preview.attendanceSummary.absentDays,
                        halfDays: preview.attendanceSummary.halfDays,
                        version,
                        status: client_1.PayrollStatus.GENERATED,
                        isRecalculated: version > 1,
                        lockedAt: new Date(),
                        salaryBreakdown: preview.salaryBreakdown,
                        attendanceBreakdown: preview.attendanceSummary,
                        advanceBreakdown,
                        overtimeBreakdown: preview.overtimeSummary,
                    },
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
                const attendanceLockStart = getAttendanceLockStart({
                    salaryType: employee.salaryType,
                    periodStart: payroll.periodStart,
                    joiningDate: employee.joiningDate,
                });
                await tx.attendance.updateMany({
                    where: {
                        employeeId: employee.id,
                        date: {
                            gte: attendanceLockStart,
                            lte: payroll.periodEnd,
                        },
                    },
                    data: {
                        lockedByPayrollId: payroll.id,
                    },
                });
                await tx.salaryHistory.updateMany({
                    where: {
                        employeeId: employee.id,
                        effectiveFrom: {
                            lte: payroll.periodEnd,
                        },
                        lockedFromPayrollId: null,
                    },
                    data: {
                        lockedFromPayrollId: payroll.id,
                    },
                });
                const settledAdvances = await settleAdvancesForPayroll(tx, preview, payroll.id);
                if (preview.advanceSummary.manualDeductionId) {
                    await tx.advanceManualDeduction.update({
                        where: {
                            id: preview.advanceSummary.manualDeductionId,
                        },
                        data: {
                            lockedByPayrollId: payroll.id,
                        },
                    });
                }
                for (const item of preview.carryForwardSummary.appliedCarryForwards) {
                    const newRemaining = roundMoney(item.remainingAmount - item.appliedAmount);
                    const applied = await tx.payrollCarryForward.updateMany({
                        where: {
                            id: item.id,
                            employeeId: employee.id,
                            cycleEndDate: {
                                lt: payroll.periodStart,
                            },
                            remainingAmount: item.remainingAmount,
                            status: {
                                in: [
                                    client_1.CarryForwardStatus.PENDING,
                                    client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                                ],
                            },
                        },
                        data: {
                            remainingAmount: newRemaining,
                            status: newRemaining <= 0
                                ? client_1.CarryForwardStatus.DEDUCTED
                                : client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                        },
                    });
                    if (applied.count !== 1) {
                        throw new app_error_1.AppError("Carry-forward balance changed while generating payroll. Refresh the payroll preview and generate again.", 409);
                    }
                }
                const sourceAdvanceSettlements = await settleAppliedCarryForwardAdvances(tx, employee.id, preview.carryForwardSummary.appliedCarryForwards);
                const carryForward = preview.result.carryForwardDeduction > 0
                    ? await tx.payrollCarryForward.create({
                        data: {
                            employeeId: employee.id,
                            sourcePayrollId: payroll.id,
                            amount: preview.result.carryForwardDeduction,
                            remainingAmount: preview.result.carryForwardDeduction,
                            cycleStartDate: payroll.periodStart,
                            cycleEndDate: payroll.periodEnd,
                            status: client_1.CarryForwardStatus.PENDING,
                        },
                    })
                    : null;
                if (sourceAdvanceSettlements.length > 0) {
                    await tx.payroll.update({
                        where: {
                            id: payroll.id,
                        },
                        data: {
                            advanceBreakdown: {
                                ...advanceBreakdown,
                                carryForwardApplied: {
                                    ...preview.carryForwardSummary,
                                    sourceAdvanceSettlements,
                                },
                            },
                        },
                    });
                }
                const ledgerEntries = await ledger_service_1.LedgerService.createPayrollLedgerTx(tx, {
                    employeeId: payroll.employeeId,
                    payrollId: payroll.id,
                    grossSalary: Number(payroll.grossSalary),
                    standardSalary: Number(payroll.standardSalary),
                    otEarnings: Number(payroll.otEarnings),
                    rawFinalSalary: Number(payroll.rawFinalSalary),
                    finalSalary: Number(payroll.finalSalary),
                    date: payroll.periodEnd,
                });
                return {
                    payroll,
                    carryForward,
                    settledAdvances,
                    ledgerEntries,
                };
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw new Error("Payroll already generated for this employee and period");
            }
            throw error;
        }
        timer.checkpoint("after payroll transaction");
        const { payroll, carryForward, settledAdvances, ledgerEntries } = payrollResult;
        let payslip = null;
        const shouldGeneratePayslipSync = data.createPayslip === true &&
            process.env.PAYSLIP_SYNC_GENERATION === "true";
        if (!shouldGeneratePayslipSync) {
            await payslip_queue_1.payslipQueue.add("generate-payslip", {
                payrollId: payroll.id,
            }, {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: false,
                removeOnFail: false,
            });
        }
        else {
            payslip = await payslip_service_1.PayslipService.createFromPayroll(payroll.id);
        }
        timer.checkpoint("payslip handling");
        if (auditContext?.userId) {
            const auditWrites = [audit_log_service_1.AuditLogService.create({
                    userId: auditContext.userId,
                    action: client_1.AuditAction.PAYROLL_GENERATE,
                    module: "PAYROLL",
                    oldData: null,
                    newData: {
                        payrollId: payroll.id,
                        employeeId: payroll.employeeId,
                        grossSalary: payroll.grossSalary,
                        standardSalary: payroll.standardSalary,
                        otTotalHours: payroll.otTotalHours,
                        otHourlyRate: payroll.otHourlyRate,
                        otEarnings: payroll.otEarnings,
                        advanceDeduction: payroll.advanceDeduction,
                        carryForwardApplied: payroll.carryForwardApplied,
                        totalDeduction: payroll.totalDeduction,
                        rawFinalSalary: payroll.rawFinalSalary,
                        finalSalary: payroll.finalSalary,
                        carryForwardDeduction: payroll.carryForwardDeduction,
                        status: payroll.status,
                    },
                    ipAddress: auditContext.ipAddress,
                    skipRelationValidation: true,
                })];
            if (carryForward) {
                auditWrites.push(audit_log_service_1.AuditLogService.create({
                    userId: auditContext.userId,
                    action: client_1.AuditAction.CREATE,
                    module: "PAYROLL",
                    oldData: null,
                    newData: {
                        type: "CARRY_FORWARD_DEDUCTION",
                        payrollId: payroll.id,
                        employeeId: payroll.employeeId,
                        amount: carryForward.amount,
                        remainingAmount: carryForward.remainingAmount,
                        status: carryForward.status,
                    },
                    ipAddress: auditContext.ipAddress,
                    skipRelationValidation: true,
                }));
            }
            await Promise.all(auditWrites);
        }
        timer.checkpoint("audit logging");
        invalidatePayrollReadCaches(employee.id);
        timer.end();
        return {
            payroll,
            payslip,
            ledgerEntries,
            settledAdvances,
            carryForward,
        };
    }
    static async list(query, authUser) {
        const { limit, cursor } = getPayrollListCursorPagination(query);
        const { directEmployeeId, employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const from = query.from ? parseDateOnly(String(query.from)) : undefined;
        const to = query.to ? parseDateOnly(String(query.to)) : undefined;
        const cacheKey = cache_1.CacheService.buildKey(PAYROLL_READ_CACHE_PREFIX, "list", authUser.role, authUser.id, query.employeeId ?? "all", query.status ?? "all", query.search?.trim().toLowerCase() || "all", query.from ?? "all", query.to ?? "all", cursor ?? "first", limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const payrolls = await payroll_repository_1.PayrollRepository.list({
            take: limit + 1,
            ...(cursor && { cursor }),
            ...(directEmployeeId && { employeeId: directEmployeeId }),
            employeeWhere,
            status: query.status,
            search: query.search ? String(query.search) : undefined,
            from,
            to,
        });
        const result = (0, cursor_pagination_util_1.buildCursorPaginationMeta)(payrolls, limit);
        void cache_1.CacheService.set(cacheKey, result, PAYROLL_READ_CACHE_TTL);
        return result;
    }
    static async getById(id) {
        const cacheKey = cache_1.CacheService.buildKey(PAYROLL_READ_CACHE_PREFIX, "detail", id);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const payroll = await payroll_repository_1.PayrollRepository.findByIdForRead(id);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        void cache_1.CacheService.set(cacheKey, payroll, PAYROLL_READ_CACHE_TTL);
        return payroll;
    }
    static async listByEmployee(employeeId, currentUserRole, query) {
        const employee = await payroll_repository_1.PayrollRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureEmployeeAccess(employee.role, currentUserRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const from = query.from ? parseDateOnly(String(query.from)) : undefined;
        const to = query.to ? parseDateOnly(String(query.to)) : undefined;
        if (from && to && from > to) {
            throw new Error("From date cannot be greater than To date");
        }
        const cacheKey = cache_1.CacheService.buildKey(PAYROLL_READ_CACHE_PREFIX, "employee", employeeId, from ? formatDate(from) : "any-from", to ? formatDate(to) : "any-to", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [payrolls, total] = await Promise.all([
            payroll_repository_1.PayrollRepository.listByEmployee(employeeId, { skip, take }, { from, to }),
            payroll_repository_1.PayrollRepository.countByEmployee(employeeId, { from, to }),
        ]);
        const result = {
            data: payrolls,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, PAYROLL_READ_CACHE_TTL);
        return result;
    }
    static async cancelPayroll(id, currentUserRole, reason, currentUserId, ipAddress) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new app_error_1.AppError("Only SUPER_ADMIN can cancel payroll", 400);
        }
        if (!reason || reason.trim().length < 5) {
            throw new app_error_1.AppError("Cancel reason is required", 400);
        }
        const payroll = await payroll_repository_1.PayrollRepository.findById(id);
        if (!payroll) {
            throw new app_error_1.AppError("Payroll not found", 404);
        }
        if (payroll.status !== client_1.PayrollStatus.GENERATED) {
            throw new app_error_1.AppError("Only GENERATED payroll can be cancelled", 400);
        }
        const appliedLaterCarryForward = await prisma_1.prisma.payrollCarryForward.findFirst({
            where: {
                sourcePayrollId: payroll.id,
                status: {
                    in: [
                        client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                        client_1.CarryForwardStatus.DEDUCTED,
                    ],
                },
            },
            select: {
                id: true,
                status: true,
            },
        });
        if (appliedLaterCarryForward) {
            throw new app_error_1.AppError("This payroll created a carry-forward balance that has already been applied to a later payroll. Cancel the later payroll first, then cancel this payroll.", 400);
        }
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const advanceBreakdown = payroll.advanceBreakdown;
            const advanceBreakdownItems = advanceBreakdown?.advances ?? [];
            const advanceBreakdownIds = advanceBreakdownItems
                .map((item) => item?.id)
                .filter(Boolean);
            const previousAdvanceById = new Map(advanceBreakdownItems.map((item) => [item.id, item]));
            const advancesToReverse = await tx.advancePayment.findMany({
                where: {
                    OR: [
                        { lockedByPayrollId: payroll.id },
                        {
                            id: {
                                in: advanceBreakdownIds,
                            },
                        },
                    ],
                },
            });
            const appliedCarryForwards = advanceBreakdown?.carryForwardApplied?.appliedCarryForwards ?? [];
            const sourceAdvanceSettlements = advanceBreakdown?.carryForwardApplied?.sourceAdvanceSettlements ?? [];
            const reversedAdvances = [];
            for (const advance of advancesToReverse) {
                const previous = previousAdvanceById.get(advance.id);
                const reversedAdvance = await tx.advancePayment.update({
                    where: { id: advance.id },
                    data: {
                        remainingAmount: previous?.previousRemainingAmount ?? advance.amount,
                        settledAmount: previous?.previousSettledAmount ?? 0,
                        carryForwardAmount: previous?.previousCarryForwardAmount ?? 0,
                        settlementStatus: previous?.previousSettlementStatus ??
                            client_1.AdvanceSettlementStatus.UNSETTLED,
                        isSettled: previous?.previousIsSettled ?? false,
                        lockedByPayrollId: null,
                    },
                });
                reversedAdvances.push(reversedAdvance);
            }
            for (const item of appliedCarryForwards) {
                await tx.payrollCarryForward.update({
                    where: { id: item.id },
                    data: {
                        remainingAmount: item.remainingAmount,
                        status: item.previousStatus ?? client_1.CarryForwardStatus.PENDING,
                    },
                });
            }
            for (const sourceSettlement of sourceAdvanceSettlements) {
                await tx.advancePayment.update({
                    where: {
                        id: sourceSettlement.advanceId,
                    },
                    data: {
                        remainingAmount: sourceSettlement.previousRemainingAmount,
                        settledAmount: sourceSettlement.previousSettledAmount,
                        carryForwardAmount: sourceSettlement.previousCarryForwardAmount,
                        settlementStatus: sourceSettlement.previousSettlementStatus,
                        isSettled: sourceSettlement.previousIsSettled,
                    },
                });
            }
            const cancelledPayroll = await tx.payroll.update({
                where: { id: payroll.id },
                data: {
                    status: client_1.PayrollStatus.CANCELLED,
                    activePayrollKey: null,
                    cancelledAt: new Date(),
                    ...(currentUserId && { cancelledById: currentUserId }),
                    cancelReason: reason,
                },
            });
            const unlockedAttendance = await tx.attendance.updateMany({
                where: {
                    lockedByPayrollId: payroll.id,
                },
                data: {
                    lockedByPayrollId: null,
                },
            });
            const unlockedAdvances = await tx.advancePayment.updateMany({
                where: {
                    lockedByPayrollId: payroll.id,
                },
                data: {
                    lockedByPayrollId: null,
                },
            });
            await tx.advanceManualDeduction.updateMany({
                where: {
                    lockedByPayrollId: payroll.id,
                },
                data: {
                    lockedByPayrollId: null,
                },
            });
            const cancelledCarryForwards = await tx.payrollCarryForward.updateMany({
                where: {
                    sourcePayrollId: payroll.id,
                    status: {
                        in: [
                            client_1.CarryForwardStatus.PENDING,
                            client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                        ],
                    },
                },
                data: {
                    status: client_1.CarryForwardStatus.CANCELLED,
                    remainingAmount: 0,
                },
            });
            const reversalLedger = await ledger_service_1.LedgerService.createPayrollPostingReversalTx(tx, {
                employeeId: payroll.employeeId,
                payrollId: payroll.id,
                date: new Date(),
            });
            return {
                cancelledPayroll,
                unlockedAttendance,
                unlockedAdvances,
                cancelledCarryForwards,
                reversedAdvances,
                advancesToReverse,
                reversalLedger,
            };
        });
        if (currentUserId) {
            await audit_log_service_1.AuditLogService.create({
                userId: currentUserId,
                action: client_1.AuditAction.DELETE,
                module: "PAYROLL_CANCEL",
                oldData: payroll,
                newData: {
                    payrollId: payroll.id,
                    status: client_1.PayrollStatus.CANCELLED,
                    reason,
                    unlocked: {
                        attendanceCount: result.unlockedAttendance.count,
                        advanceCount: result.unlockedAdvances.count,
                        carryForwardCount: result.cancelledCarryForwards.count,
                    },
                },
                ipAddress,
            });
            if (result.advancesToReverse.length > 0) {
                await audit_log_service_1.AuditLogService.create({
                    userId: currentUserId,
                    action: client_1.AuditAction.UPDATE,
                    module: "ADVANCE",
                    oldData: result.advancesToReverse,
                    newData: {
                        reason: "Payroll cancelled. Advance settlement reversed.",
                        payrollId: payroll.id,
                        reversedAdvances: result.reversedAdvances,
                    },
                    ipAddress,
                });
            }
        }
        invalidatePayrollReadCaches(payroll.employeeId);
        return {
            payroll: result.cancelledPayroll,
            unlocked: {
                attendanceCount: result.unlockedAttendance.count,
                advanceCount: result.unlockedAdvances.count + result.reversedAdvances.length,
                carryForwardCount: result.cancelledCarryForwards.count,
            },
            reversedAdvances: result.reversedAdvances.map((advance) => ({
                id: advance.id,
                remainingAmount: advance.remainingAmount,
                settlementStatus: advance.settlementStatus,
            })),
            oldPayroll: payroll,
        };
    }
    static async recalculatePayroll(id, currentUserRole, reason, currentUserId) {
        if (currentUserRole !== client_1.Role.SUPER_ADMIN) {
            throw new Error("Only SUPER_ADMIN can recalculate payroll");
        }
        if (!reason || reason.trim().length < 5) {
            throw new Error("Recalculation reason is required");
        }
        const oldPayroll = await payroll_repository_1.PayrollRepository.findById(id);
        if (!oldPayroll) {
            throw new Error("Payroll not found");
        }
        if (oldPayroll.status === client_1.PayrollStatus.PAID) {
            throw new Error("Paid payroll cannot be recalculated directly");
        }
        if (oldPayroll.status === client_1.PayrollStatus.SUPERSEDED) {
            throw new Error("Superseded payroll cannot be recalculated again");
        }
        const preview = await salary_calculation_service_1.SalaryCalculationService.preview({
            employeeId: oldPayroll.employeeId,
            periodStart: formatDate(oldPayroll.periodStart),
            periodEnd: formatDate(oldPayroll.periodEnd),
        }, {
            recalculationPayrollSnapshot: oldPayroll,
        });
        const previousAdvanceBreakdown = oldPayroll.advanceBreakdown ?? {};
        const previousCarryForwardSummary = previousAdvanceBreakdown.carryForwardApplied;
        const appliedAdvanceDeduction = Number(oldPayroll.advanceDeduction);
        const appliedCarryForward = Number(oldPayroll.carryForwardApplied);
        if (appliedAdvanceDeduction > 0 &&
            !Array.isArray(previousAdvanceBreakdown.advances)) {
            throw new app_error_1.AppError("This payroll does not contain the applied advance snapshot required for safe recalculation. Cancel the payroll and generate it again.", 400);
        }
        if (appliedCarryForward > 0 &&
            !Array.isArray(previousCarryForwardSummary?.appliedCarryForwards)) {
            throw new app_error_1.AppError("This payroll does not contain the applied carry-forward snapshot required for safe recalculation. Cancel the payroll and generate it again.", 400);
        }
        const revisedTotalDeduction = roundMoney(appliedAdvanceDeduction + appliedCarryForward);
        const revisedRawFinalSalary = roundMoney(Number(preview.result.grossSalary) - revisedTotalDeduction);
        const revisedFinalSalary = revisedRawFinalSalary < 0 ? 0 : Math.round(revisedRawFinalSalary);
        const revisedCarryForwardDeduction = revisedRawFinalSalary < 0 ? roundMoney(Math.abs(revisedRawFinalSalary)) : 0;
        preview.advanceSummary = {
            ...previousAdvanceBreakdown,
            advances: previousAdvanceBreakdown.advances ?? [],
            advanceDeduction: appliedAdvanceDeduction,
        };
        preview.carryForwardSummary = {
            ...(previousCarryForwardSummary ?? {}),
            pendingCarryForwards: previousCarryForwardSummary?.pendingCarryForwards ?? [],
            appliedCarryForwards: previousCarryForwardSummary?.appliedCarryForwards ?? [],
            carryForwardApplied: appliedCarryForward,
        };
        preview.result = {
            ...preview.result,
            advanceDeduction: appliedAdvanceDeduction,
            carryForwardApplied: appliedCarryForward,
            totalDeduction: revisedTotalDeduction,
            rawFinalSalary: revisedRawFinalSalary,
            finalSalary: revisedFinalSalary,
            carryForwardDeduction: revisedCarryForwardDeduction,
            hasCarryForward: revisedCarryForwardDeduction > 0,
            isNegativeSalary: revisedRawFinalSalary < 0,
        };
        const latestVersion = await payroll_repository_1.PayrollRepository.getLatestVersion(oldPayroll.employeeId, oldPayroll.periodStart, oldPayroll.periodEnd);
        const newVersion = latestVersion ? latestVersion.version + 1 : 1;
        const activePayrollKey = (0, payrollKey_1.buildActivePayrollKey)({
            employeeId: oldPayroll.employeeId,
            periodStart: oldPayroll.periodStart,
            periodEnd: oldPayroll.periodEnd,
        });
        const advanceBreakdown = buildAdvanceBreakdown(preview.advanceSummary, preview.carryForwardSummary);
        let recalculation;
        try {
            recalculation = await payroll_repository_1.PayrollRepository.recalculatePayroll({
                oldPayrollId: oldPayroll.id,
                newPayrollData: {
                    employeeId: oldPayroll.employeeId,
                    periodStart: oldPayroll.periodStart,
                    periodEnd: oldPayroll.periodEnd,
                    salaryType: oldPayroll.salaryType,
                    activePayrollKey,
                    grossSalary: preview.result.grossSalary,
                    standardSalary: preview.result.standardSalary,
                    otTotalHours: preview.result.otTotalHours,
                    otHourlyRate: preview.result.otHourlyRate,
                    otEarnings: preview.result.otEarnings,
                    advanceDeduction: preview.result.advanceDeduction,
                    carryForwardApplied: preview.result.carryForwardApplied,
                    totalDeduction: preview.result.totalDeduction,
                    rawFinalSalary: preview.result.rawFinalSalary,
                    finalSalary: preview.result.finalSalary,
                    carryForwardDeduction: preview.result.carryForwardDeduction,
                    totalDays: preview.attendanceSummary.workingDays,
                    workingDays: preview.attendanceSummary.workingDays,
                    presentDays: preview.attendanceSummary.presentDays,
                    absentDays: preview.attendanceSummary.absentDays +
                        preview.attendanceSummary.missingDays,
                    halfDays: preview.attendanceSummary.halfDays,
                    version: newVersion,
                    status: client_1.PayrollStatus.GENERATED,
                    lockedAt: new Date(),
                    isRecalculated: true,
                    recalculatedBy: currentUserId,
                    recalculatedAt: new Date(),
                    recalculationReason: reason,
                    replacedPayrollId: oldPayroll.id,
                    salaryBreakdown: preview.salaryBreakdown,
                    attendanceBreakdown: preview.attendanceSummary,
                    advanceBreakdown,
                    overtimeBreakdown: preview.overtimeSummary,
                },
                applyState: async (tx, { newPayroll }) => {
                    await tx.attendance.updateMany({
                        where: {
                            employeeId: oldPayroll.employeeId,
                            date: {
                                gte: getAttendanceLockStart({
                                    salaryType: oldPayroll.salaryType,
                                    periodStart: oldPayroll.periodStart,
                                    joiningDate: oldPayroll.employee.joiningDate,
                                }),
                                lte: oldPayroll.periodEnd,
                            },
                        },
                        data: {
                            lockedByPayrollId: newPayroll.id,
                        },
                    });
                    await tx.salaryHistory.updateMany({
                        where: {
                            employeeId: oldPayroll.employeeId,
                            effectiveFrom: {
                                lte: oldPayroll.periodEnd,
                            },
                            OR: [
                                {
                                    lockedFromPayrollId: oldPayroll.id,
                                },
                                {
                                    lockedFromPayrollId: null,
                                },
                            ],
                        },
                        data: {
                            lockedFromPayrollId: newPayroll.id,
                        },
                    });
                    for (const advance of previousAdvanceBreakdown.advances ?? []) {
                        await tx.advancePayment.update({
                            where: {
                                id: advance.id,
                            },
                            data: {
                                remainingAmount: advance.previousRemainingAmount ?? advance.remainingAmount,
                                settledAmount: advance.previousSettledAmount ?? 0,
                                carryForwardAmount: advance.previousCarryForwardAmount ?? 0,
                                settlementStatus: advance.previousSettlementStatus ??
                                    client_1.AdvanceSettlementStatus.UNSETTLED,
                                isSettled: advance.previousIsSettled ?? false,
                                lockedByPayrollId: null,
                            },
                        });
                    }
                    await tx.advanceManualDeduction.updateMany({
                        where: {
                            lockedByPayrollId: oldPayroll.id,
                        },
                        data: {
                            lockedByPayrollId: null,
                        },
                    });
                    await settleAdvancesForPayroll(tx, preview, newPayroll.id);
                    if (preview.advanceSummary.manualDeductionId) {
                        await tx.advanceManualDeduction.update({
                            where: {
                                id: preview.advanceSummary.manualDeductionId,
                            },
                            data: {
                                lockedByPayrollId: newPayroll.id,
                            },
                        });
                    }
                    if (!preview.advanceSummary.manualDeductionId) {
                        await tx.advancePayment.updateMany({
                            where: {
                                employeeId: oldPayroll.employeeId,
                                cycleStartDate: oldPayroll.periodStart,
                                cycleEndDate: oldPayroll.periodEnd,
                            },
                            data: {
                                lockedByPayrollId: newPayroll.id,
                            },
                        });
                    }
                    const generatedCarryForward = await tx.payrollCarryForward.findFirst({
                        where: {
                            sourcePayrollId: oldPayroll.id,
                        },
                    });
                    if (generatedCarryForward &&
                        (generatedCarryForward.status ===
                            client_1.CarryForwardStatus.PARTIALLY_DEDUCTED ||
                            generatedCarryForward.status === client_1.CarryForwardStatus.DEDUCTED)) {
                        throw new app_error_1.AppError("This payroll created a carry-forward balance that has already been applied to a later payroll. Recalculate the later payroll first.", 400);
                    }
                    if (generatedCarryForward?.status === client_1.CarryForwardStatus.PENDING) {
                        if (preview.result.carryForwardDeduction > 0) {
                            await tx.payrollCarryForward.update({
                                where: {
                                    id: generatedCarryForward.id,
                                },
                                data: {
                                    sourcePayrollId: newPayroll.id,
                                    amount: preview.result.carryForwardDeduction,
                                    remainingAmount: preview.result.carryForwardDeduction,
                                },
                            });
                        }
                        else {
                            await tx.payrollCarryForward.update({
                                where: {
                                    id: generatedCarryForward.id,
                                },
                                data: {
                                    status: client_1.CarryForwardStatus.CANCELLED,
                                    remainingAmount: 0,
                                },
                            });
                        }
                    }
                    else if (preview.result.carryForwardDeduction > 0) {
                        await tx.payrollCarryForward.create({
                            data: {
                                employeeId: newPayroll.employeeId,
                                sourcePayrollId: newPayroll.id,
                                amount: preview.result.carryForwardDeduction,
                                remainingAmount: preview.result.carryForwardDeduction,
                                cycleStartDate: newPayroll.periodStart,
                                cycleEndDate: newPayroll.periodEnd,
                                status: client_1.CarryForwardStatus.PENDING,
                            },
                        });
                    }
                    const adjustmentLedger = await ledger_service_1.LedgerService.createPayrollPostingReversalTx(tx, {
                        employeeId: oldPayroll.employeeId,
                        payrollId: oldPayroll.id,
                        date: newPayroll.periodEnd,
                    });
                    const ledgerEntries = await ledger_service_1.LedgerService.createPayrollLedgerTx(tx, {
                        employeeId: newPayroll.employeeId,
                        payrollId: newPayroll.id,
                        grossSalary: Number(newPayroll.grossSalary),
                        standardSalary: Number(newPayroll.standardSalary),
                        otEarnings: Number(newPayroll.otEarnings),
                        rawFinalSalary: Number(newPayroll.rawFinalSalary),
                        finalSalary: Number(newPayroll.finalSalary),
                        date: newPayroll.periodEnd,
                    });
                    return {
                        adjustmentLedger,
                        ledgerEntries,
                    };
                },
            });
        }
        catch (error) {
            if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002") {
                throw new Error("Payroll already generated for this employee and period");
            }
            throw error;
        }
        const payslip = await payslip_service_1.PayslipService.createFromPayroll(recalculation.newPayroll.id);
        invalidatePayrollReadCaches(oldPayroll.employeeId);
        return {
            ...recalculation,
            payslip,
        };
    }
}
exports.PayrollService = PayrollService;
//# sourceMappingURL=payroll.service.js.map