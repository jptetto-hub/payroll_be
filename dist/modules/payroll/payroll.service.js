"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollService = void 0;
const client_1 = require("@prisma/client");
const payroll_repository_1 = require("./payroll.repository");
const salary_calculation_service_1 = require("../salary-calculation/salary-calculation.service");
const payslip_service_1 = require("../payslips/payslip.service");
const ledger_service_1 = require("../ledger/ledger.service");
const audit_log_service_1 = require("../audit-logs/audit-log.service");
const prisma_1 = require("../../config/prisma");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payrollCycle_utils_1 = require("../../shared/payroll/payrollCycle.utils");
const app_error_1 = require("../../shared/utils/app-error");
const parseDateOnly = (value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
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
const buildAdvanceBreakdown = (advanceSummary, carryForwardSummary) => {
    const advances = advanceSummary.advances ?? [];
    return {
        ...advanceSummary,
        carryForwardApplied: carryForwardSummary,
        advances: advances.map((advance) => {
            const { __restoreBeforeSettlement, __previousSettledAmount, ...snapshotAdvance } = advance;
            return {
                ...snapshotAdvance,
                deductedAmount: Number(advance.remainingAmount),
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
        const settledAmount = Math.min(remainingAmount, availableForAdvance);
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
        const employee = await payroll_repository_1.PayrollRepository.findEmployee(data.employeeId);
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
        const duplicate = await payroll_repository_1.PayrollRepository.findActivePayroll(employee.id, periodStart, periodEnd);
        if (duplicate) {
            throw new Error("Active payroll already exists for this employee and period");
        }
        const preview = await salary_calculation_service_1.SalaryCalculationService.preview({
            employeeId: employee.id,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
        });
        const latestVersion = await payroll_repository_1.PayrollRepository.getLatestVersion(employee.id, periodStart, periodEnd);
        const version = latestVersion ? latestVersion.version + 1 : 1;
        const advanceBreakdown = buildAdvanceBreakdown(preview.advanceSummary, preview.carryForwardSummary);
        const payrollResult = await prisma_1.prisma.$transaction(async (tx) => {
            const payroll = await tx.payroll.create({
                data: {
                    employeeId: employee.id,
                    periodStart,
                    periodEnd,
                    salaryType: employee.salaryType,
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
            await tx.attendance.updateMany({
                where: {
                    employeeId: employee.id,
                    date: {
                        gte: payroll.periodStart,
                        lte: payroll.periodEnd,
                    },
                },
                data: {
                    lockedByPayrollId: payroll.id,
                },
            });
            const settledAdvances = await settleAdvancesForPayroll(tx, preview, payroll.id);
            for (const item of preview.carryForwardSummary.appliedCarryForwards) {
                const newRemaining = roundMoney(item.remainingAmount - item.appliedAmount);
                await tx.payrollCarryForward.update({
                    where: { id: item.id },
                    data: {
                        remainingAmount: newRemaining,
                        status: newRemaining <= 0
                            ? client_1.CarryForwardStatus.DEDUCTED
                            : client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                    },
                });
            }
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
            return {
                payroll,
                carryForward,
                settledAdvances,
            };
        });
        const { payroll, carryForward, settledAdvances } = payrollResult;
        const payslip = await payslip_service_1.PayslipService.createFromPayroll(payroll.id);
        const ledgerEntries = await ledger_service_1.LedgerService.createPayrollLedger({
            employeeId: payroll.employeeId,
            payrollId: payroll.id,
            grossSalary: Number(payroll.grossSalary),
            standardSalary: Number(payroll.standardSalary),
            otEarnings: Number(payroll.otEarnings),
            advanceDeduction: Number(payroll.advanceDeduction),
            date: payroll.periodEnd,
        });
        if (auditContext?.userId) {
            await audit_log_service_1.AuditLogService.create({
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
            });
            if (carryForward) {
                await audit_log_service_1.AuditLogService.create({
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
                });
            }
        }
        return {
            payroll,
            payslip,
            ledgerEntries,
            settledAdvances,
            carryForward,
        };
    }
    static async list(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const [payrolls, total] = await payroll_repository_1.PayrollRepository.list({
            skip,
            take,
            employeeWhere,
            status: query.status,
        });
        return {
            data: payrolls,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async getById(id) {
        const payroll = await payroll_repository_1.PayrollRepository.findById(id);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        return payroll;
    }
    static async listByEmployee(employeeId, currentUserRole, query) {
        const employee = await payroll_repository_1.PayrollRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureEmployeeAccess(employee.role, currentUserRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [payrolls, total] = await Promise.all([
            payroll_repository_1.PayrollRepository.listByEmployee(employeeId, { skip, take }),
            payroll_repository_1.PayrollRepository.countByEmployee(employeeId),
        ]);
        return {
            data: payrolls,
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
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
            const cancelledPayroll = await tx.payroll.update({
                where: { id: payroll.id },
                data: {
                    status: client_1.PayrollStatus.CANCELLED,
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
            return {
                cancelledPayroll,
                unlockedAttendance,
                unlockedAdvances,
                cancelledCarryForwards,
                reversedAdvances,
                advancesToReverse,
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
        });
        const latestVersion = await payroll_repository_1.PayrollRepository.getLatestVersion(oldPayroll.employeeId, oldPayroll.periodStart, oldPayroll.periodEnd);
        const newVersion = latestVersion ? latestVersion.version + 1 : 1;
        const advanceBreakdown = buildAdvanceBreakdown(preview.advanceSummary, preview.carryForwardSummary);
        const recalculation = await payroll_repository_1.PayrollRepository.recalculatePayroll({
            oldPayrollId: oldPayroll.id,
            newPayrollData: {
                employeeId: oldPayroll.employeeId,
                periodStart: oldPayroll.periodStart,
                periodEnd: oldPayroll.periodEnd,
                salaryType: oldPayroll.salaryType,
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
        });
        await prisma_1.prisma.attendance.updateMany({
            where: {
                employeeId: oldPayroll.employeeId,
                date: {
                    gte: oldPayroll.periodStart,
                    lte: oldPayroll.periodEnd,
                },
            },
            data: {
                lockedByPayrollId: recalculation.newPayroll.id,
            },
        });
        await prisma_1.prisma.advancePayment.updateMany({
            where: {
                employeeId: oldPayroll.employeeId,
                cycleStartDate: oldPayroll.periodStart,
                cycleEndDate: oldPayroll.periodEnd,
            },
            data: {
                lockedByPayrollId: recalculation.newPayroll.id,
            },
        });
        const payslip = await payslip_service_1.PayslipService.createFromPayroll(recalculation.newPayroll.id);
        const adjustmentLedger = await ledger_service_1.LedgerService.createAdjustmentLedger({
            employeeId: recalculation.newPayroll.employeeId,
            payrollId: recalculation.newPayroll.id,
            oldFinalSalary: Number(oldPayroll.finalSalary),
            newFinalSalary: Number(recalculation.newPayroll.finalSalary),
            date: recalculation.newPayroll.periodEnd,
        });
        return {
            ...recalculation,
            payslip,
            adjustmentLedger,
        };
    }
}
exports.PayrollService = PayrollService;
//# sourceMappingURL=payroll.service.js.map