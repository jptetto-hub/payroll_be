import {
  AuditAction,
  AdvanceSettlementStatus,
  CarryForwardStatus,
  PayrollStatus,
  Prisma,
  Role,
  SalaryType,
  WeekStartsOn,
} from "@prisma/client";
import { PayrollRepository } from "./payroll.repository";
import { SalaryCalculationService } from "../salary-calculation/salary-calculation.service";
import { PayslipService } from "../payslips/payslip.service";
import { payslipQueue } from "../../jobs/payslip.queue";
import { LedgerService } from "../ledger/ledger.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { prisma } from "../../config/prisma";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import {
  buildCursorPaginationMeta,
} from "../../shared/utils/cursor-pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { validateWeeklyPayrollCycle } from "../../shared/payroll/payrollCycle.utils";
import { AppError } from "../../shared/utils/app-error";
import { PerformanceTimer } from "../../utils/performanceTimer";
import { buildActivePayrollKey } from "../../utils/payrollKey";
import { CacheService } from "../../utils/cache";

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const PAYROLL_READ_CACHE_PREFIX = "payroll-read";
const PAYROLL_READ_CACHE_TTL = 30;

const invalidatePayrollReadCaches = (employeeId?: string) => {
  void Promise.all([
    CacheService.delByPattern(`${PAYROLL_READ_CACHE_PREFIX}:*`),
    CacheService.delByPattern("dashboard:*"),
    CacheService.delByPattern("dashboard-summary:*"),
    CacheService.delByPattern("advance-read:*"),
    CacheService.delByPattern("attendance-read:*"),
    ...(employeeId
      ? [
          CacheService.delByPattern(`salary-history-read:${employeeId}:*`),
        ]
      : []),
  ]);
  LedgerService.invalidateReadCaches();
};

const addDays = (date: Date, days: number) => {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

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

const getAttendanceLockStart = (params: {
  salaryType: SalaryType;
  periodStart: Date;
  joiningDate: Date;
}) => {
  if (
    params.salaryType !== SalaryType.WEEKLY ||
    params.periodStart.getUTCDay() !== 1
  ) {
    return params.periodStart;
  }

  const precedingSunday = addDays(params.periodStart, -1);

  return precedingSunday >= params.joiningDate
    ? precedingSunday
    : params.periodStart;
};

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
        deductedAmount: Number(advance.__deductedAmount ?? advance.remainingAmount),
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
    const requestedSettlement = Number(advance.__deductedAmount ?? remainingAmount);
    const settledAmount = roundMoney(
      Math.min(remainingAmount, requestedSettlement, availableForAdvance),
    );
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

type SourceAdvanceSettlementSnapshot = {
  carryForwardId: string;
  advanceId: string;
  appliedAmount: number;
  previousRemainingAmount: number;
  previousSettledAmount: number;
  previousCarryForwardAmount: number;
  previousSettlementStatus: AdvanceSettlementStatus;
  previousIsSettled: boolean;
};

const settleAppliedCarryForwardAdvances = async (
  tx: any,
  employeeId: string,
  appliedCarryForwards: any[],
) => {
  const sourceAdvanceSettlements: SourceAdvanceSettlementSnapshot[] = [];
  const sourcePayrollIds = [
    ...new Set(
      appliedCarryForwards
        .map((carryForward) => carryForward.sourcePayrollId)
        .filter(Boolean),
    ),
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
  const sourceAdvancesByPayrollId = new Map<string, typeof sourceAdvances>();

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

    for (const advance of sourceAdvancesByPayrollId.get(
      carryForward.sourcePayrollId,
    ) ?? []) {
      if (amountToSettle <= 0) {
        break;
      }

      const previousRemainingAmount = Number(advance.remainingAmount);
      const appliedAmount = roundMoney(
        Math.min(previousRemainingAmount, amountToSettle),
      );
      const newRemainingAmount = roundMoney(
        previousRemainingAmount - appliedAmount,
      );

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
          settlementStatus:
            newRemainingAmount <= 0
              ? AdvanceSettlementStatus.SETTLED
              : AdvanceSettlementStatus.PARTIALLY_SETTLED,
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

const getPayrollListCursorPagination = (query: any) => {
  const rawLimit = Number(query.limit ?? 50);

  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new AppError("limit must be a positive number", 400);
  }

  return {
    limit: Math.min(rawLimit, MAX_PAYROLL_LIST_LIMIT),
    cursor: query.cursor ? String(query.cursor) : undefined,
  };
};

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
      createPayslip?: boolean;
    },
    currentUserRole: Role,
    auditContext?: AuditContext,
  ) {
    const timer = new PerformanceTimer("PayrollService.generate");
    timer.checkpoint("start");

    const employee = await PayrollRepository.findEmployee(data.employeeId);
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
    const activePayrollKey = buildActivePayrollKey({
      employeeId: employee.id,
      periodStart,
      periodEnd,
    });

    const [existingActivePayroll, existingPeriodPayroll] = await Promise.all([
      PayrollRepository.findByActivePayrollKey(activePayrollKey),
      PayrollRepository.findActivePayroll(employee.id, periodStart, periodEnd),
    ]);
    timer.checkpoint("duplicate payroll check");

    if (existingActivePayroll || existingPeriodPayroll) {
      throw new Error(
        "Active payroll already exists for this employee and period",
      );
    }

    const [preview, latestVersion] = await Promise.all([
      SalaryCalculationService.preview(
        {
          employeeId: employee.id,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
        },
        {
          employee,
          skipActivePayrollSnapshot: true,
        },
      ),
      PayrollRepository.getLatestVersion(employee.id, periodStart, periodEnd),
    ]);
    timer.checkpoint("salary calculation preview and payroll version fetch");

    const version = latestVersion ? latestVersion.version + 1 : 1;

    const advanceBreakdown = buildAdvanceBreakdown(
      preview.advanceSummary,
      preview.carryForwardSummary,
    );

    timer.checkpoint("before payroll transaction");
    let payrollResult;

    try {
      payrollResult = await prisma.$transaction(async (tx) => {
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
            status: PayrollStatus.GENERATED,

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

        const settledAdvances = await settleAdvancesForPayroll(
          tx,
          preview,
          payroll.id,
        );

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
          const newRemaining = roundMoney(
            item.remainingAmount - item.appliedAmount,
          );

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
                  CarryForwardStatus.PENDING,
                  CarryForwardStatus.PARTIALLY_DEDUCTED,
                ],
              },
            },
            data: {
              remainingAmount: newRemaining,
              status:
                newRemaining <= 0
                  ? CarryForwardStatus.DEDUCTED
                  : CarryForwardStatus.PARTIALLY_DEDUCTED,
            },
          });

          if (applied.count !== 1) {
            throw new AppError(
              "Carry-forward balance changed while generating payroll. Refresh the payroll preview and generate again.",
              409,
            );
          }
        }

        const sourceAdvanceSettlements =
          await settleAppliedCarryForwardAdvances(
            tx,
            employee.id,
            preview.carryForwardSummary.appliedCarryForwards,
          );

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

        const ledgerEntries = await LedgerService.createPayrollLedgerTx(tx, {
          employeeId: payroll.employeeId,
          payrollId: payroll.id,
          grossSalary: Number(payroll.grossSalary),
          standardSalary: Number((payroll as any).standardSalary),
          otEarnings: Number((payroll as any).otEarnings),
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "Payroll already generated for this employee and period",
        );
      }

      throw error;
    }
    timer.checkpoint("after payroll transaction");

    const { payroll, carryForward, settledAdvances, ledgerEntries } =
      payrollResult;

    let payslip = null;

    const shouldGeneratePayslipSync =
      data.createPayslip === true &&
      process.env.PAYSLIP_SYNC_GENERATION === "true";

    if (!shouldGeneratePayslipSync) {
      await payslipQueue.add(
        "generate-payslip",
        {
          payrollId: payroll.id,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } else {
      payslip = await PayslipService.createFromPayroll(payroll.id);
    }
    timer.checkpoint("payslip handling");

    if (auditContext?.userId) {
      const auditWrites = [AuditLogService.create({
        userId: auditContext.userId,
        action: AuditAction.PAYROLL_GENERATE,
        module: "PAYROLL",
        oldData: null,
        newData: {
          payrollId: payroll.id,
          employeeId: payroll.employeeId,
          grossSalary: payroll.grossSalary,
          standardSalary: (payroll as any).standardSalary,
          otTotalHours: (payroll as any).otTotalHours,
          otHourlyRate: (payroll as any).otHourlyRate,
          otEarnings: (payroll as any).otEarnings,
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
        auditWrites.push(AuditLogService.create({
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

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { limit, cursor } = getPayrollListCursorPagination(query);
    const { directEmployeeId, employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });
    const from = query.from ? parseDateOnly(String(query.from)) : undefined;
    const to = query.to ? parseDateOnly(String(query.to)) : undefined;
    const cacheKey = CacheService.buildKey(
      PAYROLL_READ_CACHE_PREFIX,
      "list",
      authUser.role,
      authUser.id,
      query.employeeId ?? "all",
      query.status ?? "all",
      query.search?.trim().toLowerCase() || "all",
      query.from ?? "all",
      query.to ?? "all",
      cursor ?? "first",
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const payrolls = await PayrollRepository.list({
      take: limit + 1,
      ...(cursor && { cursor }),
      ...(directEmployeeId && { employeeId: directEmployeeId }),
      employeeWhere,
      status: query.status,
      search: query.search ? String(query.search) : undefined,
      from,
      to,
    });

    const result = buildCursorPaginationMeta(payrolls, limit);

    void CacheService.set(cacheKey, result, PAYROLL_READ_CACHE_TTL);

    return result;
  }

  static async getById(id: string) {
    const cacheKey = CacheService.buildKey(
      PAYROLL_READ_CACHE_PREFIX,
      "detail",
      id,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const payroll = await PayrollRepository.findByIdForRead(id);

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    void CacheService.set(cacheKey, payroll, PAYROLL_READ_CACHE_TTL);

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
    const from = query.from ? parseDateOnly(String(query.from)) : undefined;
    const to = query.to ? parseDateOnly(String(query.to)) : undefined;

    if (from && to && from > to) {
      throw new Error("From date cannot be greater than To date");
    }

    const cacheKey = CacheService.buildKey(
      PAYROLL_READ_CACHE_PREFIX,
      "employee",
      employeeId,
      from ? formatDate(from) : "any-from",
      to ? formatDate(to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [payrolls, total] = await Promise.all([
      PayrollRepository.listByEmployee(employeeId, { skip, take }, { from, to }),
      PayrollRepository.countByEmployee(employeeId, { from, to }),
    ]);

    const result = {
      data: payrolls,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, PAYROLL_READ_CACHE_TTL);

    return result;
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

    const appliedLaterCarryForward =
      await prisma.payrollCarryForward.findFirst({
        where: {
          sourcePayrollId: payroll.id,
          status: {
            in: [
              CarryForwardStatus.PARTIALLY_DEDUCTED,
              CarryForwardStatus.DEDUCTED,
            ],
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

    if (appliedLaterCarryForward) {
      throw new AppError(
        "This payroll created a carry-forward balance that has already been applied to a later payroll. Cancel the later payroll first, then cancel this payroll.",
        400,
      );
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
      const sourceAdvanceSettlements =
        advanceBreakdown?.carryForwardApplied?.sourceAdvanceSettlements ?? [];
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
          status: PayrollStatus.CANCELLED,
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

      const reversalLedger =
        await LedgerService.createPayrollPostingReversalTx(tx, {
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

    const preview = await SalaryCalculationService.preview(
      {
        employeeId: oldPayroll.employeeId,
        periodStart: formatDate(oldPayroll.periodStart),
        periodEnd: formatDate(oldPayroll.periodEnd),
      },
      {
        recalculationPayrollSnapshot: oldPayroll,
      },
    );
    const previousAdvanceBreakdown = (oldPayroll.advanceBreakdown as any) ?? {};
    const previousCarryForwardSummary =
      previousAdvanceBreakdown.carryForwardApplied as any;
    const appliedAdvanceDeduction = Number(oldPayroll.advanceDeduction);
    const appliedCarryForward = Number(oldPayroll.carryForwardApplied);

    if (
      appliedAdvanceDeduction > 0 &&
      !Array.isArray(previousAdvanceBreakdown.advances)
    ) {
      throw new AppError(
        "This payroll does not contain the applied advance snapshot required for safe recalculation. Cancel the payroll and generate it again.",
        400,
      );
    }

    if (
      appliedCarryForward > 0 &&
      !Array.isArray(previousCarryForwardSummary?.appliedCarryForwards)
    ) {
      throw new AppError(
        "This payroll does not contain the applied carry-forward snapshot required for safe recalculation. Cancel the payroll and generate it again.",
        400,
      );
    }

    const revisedTotalDeduction = roundMoney(
      appliedAdvanceDeduction + appliedCarryForward,
    );
    const revisedRawFinalSalary = roundMoney(
      Number(preview.result.grossSalary) - revisedTotalDeduction,
    );
    const revisedFinalSalary =
      revisedRawFinalSalary < 0 ? 0 : Math.round(revisedRawFinalSalary);
    const revisedCarryForwardDeduction =
      revisedRawFinalSalary < 0 ? roundMoney(Math.abs(revisedRawFinalSalary)) : 0;

    preview.advanceSummary = {
      ...previousAdvanceBreakdown,
      advances: previousAdvanceBreakdown.advances ?? [],
      advanceDeduction: appliedAdvanceDeduction,
    };
    preview.carryForwardSummary = {
      ...(previousCarryForwardSummary ?? {}),
      pendingCarryForwards:
        previousCarryForwardSummary?.pendingCarryForwards ?? [],
      appliedCarryForwards:
        previousCarryForwardSummary?.appliedCarryForwards ?? [],
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

    const latestVersion = await PayrollRepository.getLatestVersion(
      oldPayroll.employeeId,
      oldPayroll.periodStart,
      oldPayroll.periodEnd,
    );

    const newVersion = latestVersion ? latestVersion.version + 1 : 1;
    const activePayrollKey = buildActivePayrollKey({
      employeeId: oldPayroll.employeeId,
      periodStart: oldPayroll.periodStart,
      periodEnd: oldPayroll.periodEnd,
    });
    const advanceBreakdown = buildAdvanceBreakdown(
      preview.advanceSummary,
      preview.carryForwardSummary,
    );

    let recalculation;

    try {
      recalculation = await PayrollRepository.recalculatePayroll({
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
                remainingAmount:
                  advance.previousRemainingAmount ?? advance.remainingAmount,
                settledAmount: advance.previousSettledAmount ?? 0,
                carryForwardAmount: advance.previousCarryForwardAmount ?? 0,
                settlementStatus:
                  advance.previousSettlementStatus ??
                  AdvanceSettlementStatus.UNSETTLED,
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

          const generatedCarryForward =
            await tx.payrollCarryForward.findFirst({
              where: {
                sourcePayrollId: oldPayroll.id,
              },
            });

          if (
            generatedCarryForward &&
            (generatedCarryForward.status ===
              CarryForwardStatus.PARTIALLY_DEDUCTED ||
              generatedCarryForward.status === CarryForwardStatus.DEDUCTED)
          ) {
            throw new AppError(
              "This payroll created a carry-forward balance that has already been applied to a later payroll. Recalculate the later payroll first.",
              400,
            );
          }

          if (generatedCarryForward?.status === CarryForwardStatus.PENDING) {
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
            } else {
              await tx.payrollCarryForward.update({
                where: {
                  id: generatedCarryForward.id,
                },
                data: {
                  status: CarryForwardStatus.CANCELLED,
                  remainingAmount: 0,
                },
              });
            }
          } else if (preview.result.carryForwardDeduction > 0) {
            await tx.payrollCarryForward.create({
              data: {
                employeeId: newPayroll.employeeId,
                sourcePayrollId: newPayroll.id,
                amount: preview.result.carryForwardDeduction,
                remainingAmount: preview.result.carryForwardDeduction,
                cycleStartDate: newPayroll.periodStart,
                cycleEndDate: newPayroll.periodEnd,
                status: CarryForwardStatus.PENDING,
              },
            });
          }

          const adjustmentLedger =
            await LedgerService.createPayrollPostingReversalTx(tx, {
              employeeId: oldPayroll.employeeId,
              payrollId: oldPayroll.id,
              date: newPayroll.periodEnd,
            });

          const ledgerEntries = await LedgerService.createPayrollLedgerTx(tx, {
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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new Error(
          "Payroll already generated for this employee and period",
        );
      }

      throw error;
    }

    const payslip = await PayslipService.createFromPayroll(
      recalculation.newPayroll.id,
    );

    invalidatePayrollReadCaches(oldPayroll.employeeId);

    return {
      ...recalculation,
      payslip,
    };
  }
}
