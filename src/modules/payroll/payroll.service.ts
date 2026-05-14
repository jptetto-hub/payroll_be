import {
  AuditAction,
  AdvanceSettlementStatus,
  CarryForwardStatus,
  PayrollStatus,
  Role,
  SalaryType,
  WeekStartsOn,
} from "@prisma/client";
import { PayrollRepository } from "./payroll.repository";
import { SalaryCalculationService } from "../salary-calculation/salary-calculation.service";
import { PayslipService } from "../payslips/payslip.service";
import { LedgerService } from "../ledger/ledger.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { prisma } from "../../config/prisma";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { validateWeeklyPayrollCycle } from "../../shared/payroll/payrollCycle.utils";
import { AppError } from "../../shared/utils/app-error";

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const ensureDateOnOrAfterJoining = (params: {
  date: Date;
  joiningDate: Date;
  action: string;
}) => {
  if (formatDate(params.date) < formatDate(params.joiningDate)) {
    throw new Error(
      `${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`,
    );
  }
};

const getMonthStart = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
};

const getMonthEnd = (date: Date) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
};

const isSameDate = (a: Date, b: Date) => formatDate(a) === formatDate(b);

const buildAdvanceBreakdown = (
  advanceSummary: any,
  carryForwardSummary?: any,
) => {
  const advances = advanceSummary.advances ?? [];

  return {
    ...advanceSummary,
    carryForwardApplied: carryForwardSummary,
    advances: advances.map((advance: any) => {
      const {
        __restoreBeforeSettlement,
        __previousSettledAmount,
        ...snapshotAdvance
      } = advance;

      return {
        ...snapshotAdvance,
        deductedAmount: Number(advance.remainingAmount),
        previousRemainingAmount: advance.remainingAmount,
        previousSettledAmount: advance.settledAmount ?? 0,
        previousCarryForwardAmount: advance.carryForwardAmount ?? 0,
        previousSettlementStatus:
          advance.settlementStatus ?? AdvanceSettlementStatus.UNSETTLED,
        previousIsSettled: advance.isSettled,
      };
    }),
  };
};

const settleAdvancesForPayroll = async (
  tx: any,
  calculation: any,
  payrollId: string,
) => {
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
        settlementStatus:
          newRemaining <= 0
            ? AdvanceSettlementStatus.SETTLED
            : settledAmount > 0
              ? AdvanceSettlementStatus.PARTIALLY_SETTLED
              : AdvanceSettlementStatus.UNSETTLED,
        carryForwardAmount: newRemaining,
        lockedByPayrollId: payrollId,
      },
    });

    settledAdvances.push(updatedAdvance);
    availableForAdvance = roundMoney(availableForAdvance - settledAmount);
  }

  return settledAdvances;
};

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

type AuditContext = {
  userId?: string | undefined;
  ipAddress?: string | undefined;
};

const ensureEmployeeAccess = (targetRole: Role, currentRole: Role) => {
  if (currentRole === Role.ADMIN && targetRole !== Role.USER) {
    throw new Error("ADMIN can generate payroll only for USER employees");
  }
};

const validatePayrollPeriod = async (
  salaryType: SalaryType,
  periodStart: Date,
  periodEnd: Date,
) => {
  if (periodStart > periodEnd) {
    throw new Error("periodStart cannot be greater than periodEnd");
  }

  const setting = await PayrollRepository.getSystemSetting();
  const weekStartsOn = setting?.weekStartsOn ?? WeekStartsOn.MONDAY;

  if (salaryType === SalaryType.MONTHLY) {
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

  validateWeeklyPayrollCycle(periodStart, periodEnd, weekStartsOn);
};

export class PayrollService {
  static async generate(
    data: {
      employeeId: string;
      periodStart: string;
      periodEnd: string;
    },
    currentUserRole: Role,
    auditContext?: AuditContext,
  ) {
    const employee = await PayrollRepository.findEmployee(data.employeeId);

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

    const duplicate = await PayrollRepository.findActivePayroll(
      employee.id,
      periodStart,
      periodEnd,
    );

    if (duplicate) {
      throw new Error(
        "Active payroll already exists for this employee and period",
      );
    }

    const preview = await SalaryCalculationService.preview({
      employeeId: employee.id,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
    });

    const latestVersion = await PayrollRepository.getLatestVersion(
      employee.id,
      periodStart,
      periodEnd,
    );

    const version = latestVersion ? latestVersion.version + 1 : 1;
    const advanceBreakdown = buildAdvanceBreakdown(
      preview.advanceSummary,
      preview.carryForwardSummary,
    );

    const payrollResult = await prisma.$transaction(async (tx) => {
      const payroll = await tx.payroll.create({
        data: {
          employeeId: employee.id,
          periodStart,
          periodEnd,
          salaryType: employee.salaryType,
          grossSalary: preview.result.grossSalary,
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
          status: PayrollStatus.GENERATED,

          isRecalculated: version > 1,
          lockedAt: new Date(),

          salaryBreakdown: preview.salaryBreakdown,
          attendanceBreakdown: preview.attendanceSummary,
          advanceBreakdown,
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

      const settledAdvances = await settleAdvancesForPayroll(
        tx,
        preview,
        payroll.id,
      );

      for (const item of preview.carryForwardSummary.appliedCarryForwards) {
        const newRemaining = roundMoney(
          item.remainingAmount - item.appliedAmount,
        );

        await tx.payrollCarryForward.update({
          where: { id: item.id },
          data: {
            remainingAmount: newRemaining,
            status:
              newRemaining <= 0
                ? CarryForwardStatus.DEDUCTED
                : CarryForwardStatus.PARTIALLY_DEDUCTED,
          },
        });
      }

      const carryForward =
        preview.result.carryForwardDeduction > 0
          ? await tx.payrollCarryForward.create({
              data: {
                employeeId: employee.id,
                sourcePayrollId: payroll.id,
                amount: preview.result.carryForwardDeduction,
                remainingAmount: preview.result.carryForwardDeduction,
                cycleStartDate: payroll.periodStart,
                cycleEndDate: payroll.periodEnd,
                status: CarryForwardStatus.PENDING,
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

    const payslip = await PayslipService.createFromPayroll(payroll.id);

    const ledgerEntries = await LedgerService.createPayrollLedger({
      employeeId: payroll.employeeId,
      payrollId: payroll.id,
      grossSalary: Number(payroll.grossSalary),
      advanceDeduction: Number(payroll.advanceDeduction),
      date: payroll.periodEnd,
    });

    if (auditContext?.userId) {
      await AuditLogService.create({
        userId: auditContext.userId,
        action: AuditAction.PAYROLL_GENERATE,
        module: "PAYROLL",
        oldData: null,
        newData: {
          payrollId: payroll.id,
          employeeId: payroll.employeeId,
          grossSalary: payroll.grossSalary,
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
        await AuditLogService.create({
          userId: auditContext.userId,
          action: AuditAction.CREATE,
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

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const [payrolls, total] = await PayrollRepository.list({
      skip,
      take,
      employeeWhere,
      status: query.status,
    });

    return {
      data: payrolls,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async getById(id: string) {
    const payroll = await PayrollRepository.findById(id);

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    return payroll;
  }

  static async listByEmployee(
    employeeId: string,
    currentUserRole: Role,
    query: any,
  ) {
    const employee = await PayrollRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureEmployeeAccess(employee.role, currentUserRole);

    const { page, limit, skip, take } = getPagination(query);
    const [payrolls, total] = await Promise.all([
      PayrollRepository.listByEmployee(employeeId, { skip, take }),
      PayrollRepository.countByEmployee(employeeId),
    ]);

    return {
      data: payrolls,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async cancelPayroll(
    id: string,
    currentUserRole: Role,
    reason: string,
    currentUserId?: string,
    ipAddress?: string,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new AppError("Only SUPER_ADMIN can cancel payroll", 400);
    }

    if (!reason || reason.trim().length < 5) {
      throw new AppError("Cancel reason is required", 400);
    }

    const payroll = await PayrollRepository.findById(id);

    if (!payroll) {
      throw new AppError("Payroll not found", 404);
    }

    if (payroll.status !== PayrollStatus.GENERATED) {
      throw new AppError("Only GENERATED payroll can be cancelled", 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const advanceBreakdown = payroll.advanceBreakdown as any;
      const advanceBreakdownItems = advanceBreakdown?.advances ?? [];
      const advanceBreakdownIds = advanceBreakdownItems
        .map((item: any) => item?.id)
        .filter(Boolean);
      const previousAdvanceById = new Map(
        advanceBreakdownItems.map((item: any) => [item.id, item]),
      );
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
      const appliedCarryForwards =
        advanceBreakdown?.carryForwardApplied?.appliedCarryForwards ?? [];
      const reversedAdvances = [];

      for (const advance of advancesToReverse) {
        const previous = previousAdvanceById.get(advance.id) as any;

        const reversedAdvance = await tx.advancePayment.update({
          where: { id: advance.id },
          data: {
            remainingAmount:
              previous?.previousRemainingAmount ?? advance.amount,
            settledAmount: previous?.previousSettledAmount ?? 0,
            carryForwardAmount: previous?.previousCarryForwardAmount ?? 0,
            settlementStatus:
              previous?.previousSettlementStatus ??
              AdvanceSettlementStatus.UNSETTLED,
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
            status: item.previousStatus ?? CarryForwardStatus.PENDING,
          },
        });
      }

      const cancelledPayroll = await tx.payroll.update({
        where: { id: payroll.id },
        data: {
          status: PayrollStatus.CANCELLED,
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
              CarryForwardStatus.PENDING,
              CarryForwardStatus.PARTIALLY_DEDUCTED,
            ],
          },
        },
        data: {
          status: CarryForwardStatus.CANCELLED,
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
      await AuditLogService.create({
        userId: currentUserId,
        action: AuditAction.DELETE,
        module: "PAYROLL_CANCEL",
        oldData: payroll,
        newData: {
          payrollId: payroll.id,
          status: PayrollStatus.CANCELLED,
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
        await AuditLogService.create({
          userId: currentUserId,
          action: AuditAction.UPDATE,
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

  static async recalculatePayroll(
    id: string,
    currentUserRole: Role,
    reason: string,
    currentUserId: string,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can recalculate payroll");
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error("Recalculation reason is required");
    }

    const oldPayroll = await PayrollRepository.findById(id);

    if (!oldPayroll) {
      throw new Error("Payroll not found");
    }

    if (oldPayroll.status === PayrollStatus.PAID) {
      throw new Error("Paid payroll cannot be recalculated directly");
    }

    if (oldPayroll.status === PayrollStatus.SUPERSEDED) {
      throw new Error("Superseded payroll cannot be recalculated again");
    }

    const preview = await SalaryCalculationService.preview({
      employeeId: oldPayroll.employeeId,
      periodStart: formatDate(oldPayroll.periodStart),
      periodEnd: formatDate(oldPayroll.periodEnd),
    });

    const latestVersion = await PayrollRepository.getLatestVersion(
      oldPayroll.employeeId,
      oldPayroll.periodStart,
      oldPayroll.periodEnd,
    );

    const newVersion = latestVersion ? latestVersion.version + 1 : 1;
    const advanceBreakdown = buildAdvanceBreakdown(
      preview.advanceSummary,
      preview.carryForwardSummary,
    );

    const recalculation = await PayrollRepository.recalculatePayroll({
      oldPayrollId: oldPayroll.id,
      newPayrollData: {
        employeeId: oldPayroll.employeeId,
        periodStart: oldPayroll.periodStart,
        periodEnd: oldPayroll.periodEnd,
        salaryType: oldPayroll.salaryType,

        grossSalary: preview.result.grossSalary,
        advanceDeduction: preview.result.advanceDeduction,
        carryForwardApplied: preview.result.carryForwardApplied,
        totalDeduction: preview.result.totalDeduction,
        rawFinalSalary: preview.result.rawFinalSalary,
        finalSalary: preview.result.finalSalary,
        carryForwardDeduction: preview.result.carryForwardDeduction,

        totalDays: preview.attendanceSummary.workingDays,
        workingDays: preview.attendanceSummary.workingDays,
        presentDays: preview.attendanceSummary.presentDays,
        absentDays:
          preview.attendanceSummary.absentDays +
          preview.attendanceSummary.missingDays,
        halfDays: preview.attendanceSummary.halfDays,

        version: newVersion,
        status: PayrollStatus.GENERATED,
        lockedAt: new Date(),

        isRecalculated: true,
        recalculatedBy: currentUserId,
        recalculatedAt: new Date(),
        recalculationReason: reason,

        replacedPayrollId: oldPayroll.id,

        salaryBreakdown: preview.salaryBreakdown,
        attendanceBreakdown: preview.attendanceSummary,
        advanceBreakdown,
      },
    });

    await prisma.attendance.updateMany({
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

    await prisma.advancePayment.updateMany({
      where: {
        employeeId: oldPayroll.employeeId,
        cycleStartDate: oldPayroll.periodStart,
        cycleEndDate: oldPayroll.periodEnd,
      },
      data: {
        lockedByPayrollId: recalculation.newPayroll.id,
      },
    });

    const payslip = await PayslipService.createFromPayroll(
      recalculation.newPayroll.id,
    );

    const adjustmentLedger = await LedgerService.createAdjustmentLedger({
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
