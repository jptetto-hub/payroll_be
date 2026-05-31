import { LedgerType, PayrollStatus, Role } from "@prisma/client";
import { LedgerRepository } from "./ledger.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import {
  buildCursorPaginationMeta,
  getCursorPagination,
} from "../../shared/utils/cursor-pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { CacheService } from "../../utils/cache";

const LEDGER_READ_CACHE_PREFIX = "ledger-read";
const LEDGER_READ_CACHE_TTL = 30;

const ensureEmployeeAccess = (targetRole: Role, currentRole: Role) => {
  if (currentRole === Role.ADMIN && targetRole !== Role.USER) {
    throw new Error("ADMIN can access ledger only for USER employees");
  }
};

const roundMoney = (amount: number) => Math.round(amount * 100) / 100;

const getPayrollRoundingAdjustment = (params: {
  rawFinalSalary?: number;
  finalSalary?: number;
}) => {
  if (
    params.rawFinalSalary === undefined ||
    params.finalSalary === undefined ||
    params.rawFinalSalary < 0
  ) {
    return 0;
  }

  return roundMoney(params.finalSalary - params.rawFinalSalary);
};

const getPayrollLedgerContribution = (params: {
  grossSalary: number;
  rawFinalSalary?: number;
  finalSalary?: number;
}) =>
  roundMoney(params.grossSalary + getPayrollRoundingAdjustment(params));

const getCycleStatement = (payroll?: any | null) => {
  if (!payroll) return null;

  const grossSalary = Number(payroll.grossSalary ?? 0);
  const advanceDeduction = Number(payroll.advanceDeduction ?? 0);
  const carryForwardApplied = Number(payroll.carryForwardApplied ?? 0);
  const totalDeduction = Number(payroll.totalDeduction ?? 0);
  const rawFinalSalary = Number(payroll.rawFinalSalary ?? 0);
  const finalSalary = Number(payroll.finalSalary ?? 0);
  const carryForwardDeduction = Number(payroll.carryForwardDeduction ?? 0);

  return {
    payrollId: payroll.id,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    salaryType: payroll.salaryType,
    payrollVersion: payroll.version ?? null,
    payrollStatus: payroll.status ?? null,
    grossSalary: roundMoney(grossSalary),
    advanceDeduction: roundMoney(advanceDeduction),
    carryForwardApplied: roundMoney(carryForwardApplied),
    totalDeduction: roundMoney(totalDeduction),
    rawFinalSalary: roundMoney(rawFinalSalary),
    finalSalary: roundMoney(finalSalary),
    carryForwardDeduction: roundMoney(carryForwardDeduction),
    cycleBalance: roundMoney(rawFinalSalary),
    payableAmount: roundMoney(finalSalary),
    nextCycleCarryForward: roundMoney(carryForwardDeduction),
  };
};

const getRowCalculation = (entry: any, cycleStatement: any | null) => {
  const entryMovement = roundMoney(Number(entry.credit) - Number(entry.debit));

  if (!cycleStatement) {
    return {
      openingBalance: 0,
      movement: entryMovement,
      balanceAfterEntry: entryMovement,
      finalCycleBalance: entryMovement,
      formula: entryMovement >= 0 ? "0 + movement" : "0 - movement",
    };
  }

  const standardSalary = Number(entry.payroll?.standardSalary ?? 0);
  const otEarnings = Number(entry.payroll?.otEarnings ?? 0);
  const grossSalary = Number(cycleStatement.grossSalary ?? 0);
  const totalDeduction = Number(cycleStatement.totalDeduction ?? 0);
  const roundingMovement = roundMoney(
    Number(cycleStatement.payableAmount ?? 0) -
      Number(cycleStatement.rawFinalSalary ?? 0),
  );

  switch (entry.type) {
    case LedgerType.SALARY:
      return {
        openingBalance: 0,
        movement: roundMoney(standardSalary || entryMovement),
        balanceAfterEntry: roundMoney(standardSalary || entryMovement),
        finalCycleBalance: cycleStatement.cycleBalance,
        formula: "0 + salary",
      };

    case LedgerType.OVERTIME:
      return {
        openingBalance: roundMoney(grossSalary - otEarnings),
        movement: roundMoney(otEarnings || entryMovement),
        balanceAfterEntry: grossSalary,
        finalCycleBalance: cycleStatement.cycleBalance,
        formula: "salary + OT",
      };

    case LedgerType.ADVANCE:
    case LedgerType.DEDUCTION:
      return {
        openingBalance: grossSalary,
        movement: roundMoney(-totalDeduction || entryMovement),
        balanceAfterEntry: cycleStatement.cycleBalance,
        finalCycleBalance: cycleStatement.cycleBalance,
        formula: "gross earning - recovery",
      };

    case LedgerType.ADJUSTMENT:
      return {
        openingBalance: cycleStatement.cycleBalance,
        movement: roundingMovement,
        balanceAfterEntry:
          roundingMovement === 0
            ? cycleStatement.cycleBalance
            : cycleStatement.payableAmount,
        finalCycleBalance: cycleStatement.cycleBalance,
        formula: "cycle balance + rounding",
      };

    default:
      return {
        openingBalance: 0,
        movement: entryMovement,
        balanceAfterEntry: entryMovement,
        finalCycleBalance: cycleStatement.cycleBalance,
        formula: "opening + movement",
      };
  }
};

export class LedgerService {
  static invalidateReadCaches() {
    void CacheService.delByPattern(`${LEDGER_READ_CACHE_PREFIX}:*`);
  }

  private static async getEmployeeSummaryCached(
    employeeId: string,
    query: any,
  ) {
    const cacheKey = CacheService.buildKey(
      LEDGER_READ_CACHE_PREFIX,
      "summary",
      employeeId,
      query.from ?? "all",
      query.to ?? "all",
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const summary = await LedgerRepository.getActiveStatementSummary({
      employeeWhere: { id: employeeId },
      employeeId,
      from: query.from,
      to: query.to,
    });

    void CacheService.set(cacheKey, summary, LEDGER_READ_CACHE_TTL);

    return summary;
  }

  static async createAdvanceLedger(params: {
    employeeId: string;
    advanceId: string;
    amount: number;
    date: Date;
  }) {
    const lastBalance = await LedgerRepository.getLastBalance(
      params.employeeId,
    );
    const balance = lastBalance - params.amount;

    const entry = await LedgerRepository.create({
      employeeId: params.employeeId,
      type: LedgerType.ADVANCE,
      referenceId: params.advanceId,
      debit: params.amount,
      credit: 0,
      balance,
      date: params.date,
    });

    this.invalidateReadCaches();

    return entry;
  }

  static async createPayrollLedger(params: {
    employeeId: string;
    payrollId: string;
    grossSalary: number;
    standardSalary?: number;
    otEarnings?: number;
    rawFinalSalary?: number;
    finalSalary?: number;
    date: Date;
  }) {
    const entries = [];

    let balance = await LedgerRepository.getLastBalance(params.employeeId);
    const standardSalary = params.standardSalary ?? params.grossSalary;
    const otEarnings = params.otEarnings ?? 0;

    balance += standardSalary;

    const salaryEntry = await LedgerRepository.create({
      employeeId: params.employeeId,
      payrollId: params.payrollId,
      type: LedgerType.SALARY,
      referenceId: params.payrollId,
      debit: 0,
      credit: standardSalary,
      balance,
      date: params.date,
    });

    entries.push(salaryEntry);

    if (otEarnings > 0) {
      balance += otEarnings;

      const otEntry = await LedgerRepository.create({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: "OVERTIME" as LedgerType,
        referenceId: params.payrollId,
        debit: 0,
        credit: otEarnings,
        balance,
        date: params.date,
      });

      entries.push(otEntry);
    }

    const roundingAdjustment = getPayrollRoundingAdjustment(params);

    if (roundingAdjustment !== 0) {
      balance = roundMoney(balance + roundingAdjustment);

      const roundingEntry = await LedgerRepository.create({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: roundingAdjustment < 0 ? Math.abs(roundingAdjustment) : 0,
        credit: roundingAdjustment > 0 ? roundingAdjustment : 0,
        balance,
        date: params.date,
      });

      entries.push(roundingEntry);
    }

    this.invalidateReadCaches();

    return entries;
  }

  static async createPayrollLedgerTx(
    tx: any,
    params: {
      employeeId: string;
      payrollId: string;
      grossSalary: number;
      standardSalary?: number;
      otEarnings?: number;
      rawFinalSalary?: number;
      finalSalary?: number;
      date: Date;
    },
  ) {
    const entries = [];

    const lastEntry = await LedgerRepository.getLastEntryTx(tx, params.employeeId);
    let balance = lastEntry ? Number(lastEntry.balance) : 0;
    const standardSalary = params.standardSalary ?? params.grossSalary;
    const otEarnings = params.otEarnings ?? 0;

    balance += standardSalary;

    entries.push({
      employeeId: params.employeeId,
      payrollId: params.payrollId,
      type: LedgerType.SALARY,
      referenceId: params.payrollId,
      debit: 0,
      credit: standardSalary,
      balance,
      date: params.date,
    });

    if (otEarnings > 0) {
      balance += otEarnings;

      entries.push({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.OVERTIME,
        referenceId: params.payrollId,
        debit: 0,
        credit: otEarnings,
        balance,
        date: params.date,
      });
    }

    const roundingAdjustment = getPayrollRoundingAdjustment(params);

    if (roundingAdjustment !== 0) {
      balance = roundMoney(balance + roundingAdjustment);

      entries.push({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: roundingAdjustment < 0 ? Math.abs(roundingAdjustment) : 0,
        credit: roundingAdjustment > 0 ? roundingAdjustment : 0,
        balance,
        date: params.date,
      });
    }

    const firstPostingTime = Math.max(
      Date.now(),
      lastEntry ? lastEntry.createdAt.getTime() + 1 : 0,
    );

    return LedgerRepository.createManyAndReturnTx(
      tx,
      entries.map((entry, index) => ({
        ...entry,
        createdAt: new Date(firstPostingTime + index),
      })),
    );
  }

  static async createAdjustmentLedger(params: {
    employeeId: string;
    payrollId: string;
    oldGrossSalary: number;
    oldRawFinalSalary?: number;
    oldFinalSalary: number;
    oldPostedContribution?: number;
    newGrossSalary: number;
    newRawFinalSalary?: number;
    newFinalSalary: number;
    date: Date;
  }) {
    const difference = roundMoney(
      getPayrollLedgerContribution({
        grossSalary: params.newGrossSalary,
        rawFinalSalary: params.newRawFinalSalary,
        finalSalary: params.newFinalSalary,
      }) -
        (params.oldPostedContribution ??
          getPayrollLedgerContribution({
            grossSalary: params.oldGrossSalary,
            rawFinalSalary: params.oldRawFinalSalary,
            finalSalary: params.oldFinalSalary,
          })),
    );

    if (difference === 0) {
      return null;
    }

    let balance = await LedgerRepository.getLastBalance(params.employeeId);

    if (difference > 0) {
      balance += difference;

      const entry = await LedgerRepository.create({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: 0,
        credit: difference,
        balance,
        date: params.date,
      });

      this.invalidateReadCaches();

      return entry;
    }

    balance -= Math.abs(difference);

    const entry = await LedgerRepository.create({
      employeeId: params.employeeId,
      payrollId: params.payrollId,
      type: LedgerType.ADJUSTMENT,
      referenceId: params.payrollId,
      debit: Math.abs(difference),
      credit: 0,
      balance,
      date: params.date,
    });

    this.invalidateReadCaches();

    return entry;
  }

  static async createAdjustmentLedgerTx(
    tx: any,
    params: {
      employeeId: string;
      payrollId: string;
      oldGrossSalary: number;
      oldRawFinalSalary?: number;
      oldFinalSalary: number;
      oldPostedContribution?: number;
      newGrossSalary: number;
      newRawFinalSalary?: number;
      newFinalSalary: number;
      date: Date;
    },
  ) {
    const difference = roundMoney(
      getPayrollLedgerContribution({
        grossSalary: params.newGrossSalary,
        rawFinalSalary: params.newRawFinalSalary,
        finalSalary: params.newFinalSalary,
      }) -
        (params.oldPostedContribution ??
          getPayrollLedgerContribution({
            grossSalary: params.oldGrossSalary,
            rawFinalSalary: params.oldRawFinalSalary,
            finalSalary: params.oldFinalSalary,
          })),
    );

    if (difference === 0) {
      return null;
    }

    const lastEntry = await LedgerRepository.getLastEntryTx(tx, params.employeeId);
    let balance = lastEntry ? Number(lastEntry.balance) : 0;
    const createdAt = new Date(
      Math.max(Date.now(), lastEntry ? lastEntry.createdAt.getTime() + 1 : 0),
    );

    if (difference > 0) {
      balance += difference;

      return tx.ledgerEntry.create({
        data: {
          employeeId: params.employeeId,
          payrollId: params.payrollId,
          type: LedgerType.ADJUSTMENT,
          referenceId: params.payrollId,
          debit: 0,
          credit: difference,
          balance,
          date: params.date,
          createdAt,
        },
      });
    }

    balance -= Math.abs(difference);

    return tx.ledgerEntry.create({
      data: {
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: Math.abs(difference),
        credit: 0,
        balance,
        date: params.date,
        createdAt,
      },
    });
  }

  static async createPayrollPostingReversalTx(
    tx: any,
    params: { employeeId: string; payrollId: string; date: Date },
  ) {
    const postedEntries = await tx.ledgerEntry.findMany({
      where: {
        payrollId: params.payrollId,
      },
      select: {
        debit: true,
        credit: true,
      },
    });
    const postedContribution = roundMoney(
      postedEntries.reduce(
        (sum: number, entry: { debit: unknown; credit: unknown }) =>
          sum + Number(entry.credit) - Number(entry.debit),
        0,
      ),
    );

    if (postedContribution === 0) {
      return null;
    }

    const lastEntry = await LedgerRepository.getLastEntryTx(tx, params.employeeId);
    const lastBalance = lastEntry ? Number(lastEntry.balance) : 0;
    const reversalAmount = Math.abs(postedContribution);
    const balance = roundMoney(lastBalance - postedContribution);

    return tx.ledgerEntry.create({
      data: {
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: postedContribution > 0 ? reversalAmount : 0,
        credit: postedContribution < 0 ? reversalAmount : 0,
        balance,
        date: params.date,
        createdAt: new Date(
          Math.max(
            Date.now(),
            lastEntry ? lastEntry.createdAt.getTime() + 1 : 0,
          ),
        ),
      },
    });
  }

  private static async enrichEntries(entries: any[]) {
    const advanceIds = Array.from(
      new Set(
        entries
          .filter(
            (entry) =>
              entry.type === LedgerType.ADVANCE && Boolean(entry.referenceId),
          )
          .map((entry) => entry.referenceId as string),
      ),
    );
    const advances =
      advanceIds.length > 0
        ? await LedgerRepository.findAdvancesByIds(advanceIds)
        : [];
    const advanceById = new Map(advances.map((advance) => [advance.id, advance]));
    const payrollIdsFromAdvances = advances
      .map((advance) => advance.lockedByPayrollId)
      .filter(Boolean) as string[];
    const payrollIds = Array.from(new Set(payrollIdsFromAdvances));
    const payrollsById =
      payrollIds.length > 0
        ? new Map(
            (await LedgerRepository.findPayrollsByIds(payrollIds)).map(
              (payroll) => [payroll.id, payroll],
            ),
          )
        : new Map<string, any>();

    const enrichedEntries = entries.map((entry) => {
      const advance =
        entry.type === LedgerType.ADVANCE
          ? advanceById.get(entry.referenceId)
          : undefined;
      const cyclePayroll =
        entry.payroll ?? payrollsById.get(advance?.lockedByPayrollId ?? "");
      const periodStart = entry.payroll?.periodStart ?? advance?.cycleStartDate;
      const periodEnd = entry.payroll?.periodEnd ?? advance?.cycleEndDate;
      const salaryType = entry.payroll?.salaryType ?? advance?.payCycleType;
      const isVoidedPayroll =
        entry.payroll?.status === PayrollStatus.CANCELLED ||
        entry.payroll?.status === PayrollStatus.SUPERSEDED;
      const isLegacyDeduction = entry.type === LedgerType.DEDUCTION;
      const expectedRoundingAdjustment = entry.payroll
        ? getPayrollRoundingAdjustment({
            rawFinalSalary: Number(entry.payroll.rawFinalSalary),
            finalSalary: Number(entry.payroll.finalSalary),
          })
        : 0;
      const entryMovement = roundMoney(
        Number(entry.credit) - Number(entry.debit),
      );
      const isLegacyRecalculationAdjustment =
        entry.type === LedgerType.ADJUSTMENT &&
        Boolean(entry.payroll) &&
        !isVoidedPayroll &&
        Math.abs(entryMovement - expectedRoundingAdjustment) > 0.01;
      const includedInActiveBalance =
        !isVoidedPayroll &&
        !isLegacyDeduction &&
        !isLegacyRecalculationAdjustment;

      const narration = (() => {
        switch (entry.type) {
          case LedgerType.SALARY:
            return "Attendance-based salary credited for this payroll cycle.";
          case LedgerType.OVERTIME:
            return "Overtime earning credited for this payroll cycle.";
          case LedgerType.ADVANCE:
            return "Advance paid; recovery is shown in the selected payroll cycle breakdown.";
          case LedgerType.DEDUCTION:
            return "Historical payroll recovery debit entry.";
          case LedgerType.ADJUSTMENT:
            if (entry.payroll?.status === "CANCELLED") {
              return "Cancelled payroll earnings reversed from the running balance.";
            }
            if (entry.payroll?.status === "SUPERSEDED") {
              return "Superseded payroll version reversed before revised posting.";
            }
            if (isLegacyRecalculationAdjustment) {
              return "Historical recalculation adjustment; current payroll amount is used in the active statement.";
            }
            return "Payable rounding adjustment for this payroll cycle.";
          default:
            return "Ledger movement.";
        }
      })();

      const cycleStatement = getCycleStatement(cyclePayroll);

      return {
        ...entry,
        payrollCycle:
          periodStart && periodEnd
            ? {
                periodStart,
                periodEnd,
                salaryType,
                payrollVersion: entry.payroll?.version ?? null,
                payrollStatus: entry.payroll?.status ?? null,
              }
            : null,
        advanceDetails: advance ?? null,
        cycleStatement,
        rowCalculation: getRowCalculation(entry, cycleStatement),
        narration,
        includedInActiveBalance,
        accountingStatus: isVoidedPayroll
          ? "HISTORICAL_EXCLUDED"
          : isLegacyDeduction || isLegacyRecalculationAdjustment
            ? "LEGACY_EXCLUDED"
            : "ACTIVE",
        legacyWarning:
          isLegacyDeduction
            ? "This historical deduction may require reconciliation if the related advance was already recorded as a debit."
            : isLegacyRecalculationAdjustment
              ? "This adjustment was created by earlier recalculation logic and is excluded from the active statement total."
              : null,
      };
    });

    return enrichedEntries.map((entry) => {
      const rowBalance = entry.rowCalculation?.balanceAfterEntry ?? 0;
      const businessBalance = entry.cycleStatement?.cycleBalance ?? rowBalance;

      return {
        ...entry,
        storedBalance: entry.balance,
        balance: businessBalance,
        realBalance: businessBalance,
      };
    });
  }

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { limit, cursor } = getCursorPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });
    const includeSummary = query.includeSummary === "true";
    const directEmployeeId =
      authUser.role === Role.USER
        ? authUser.id
        : query.employeeId && query.employeeId !== "all"
          ? query.employeeId
          : undefined;

    const [entries, summary] = await Promise.all([
      LedgerRepository.listAll({
        take: limit + 1,
        ...(cursor && { cursor }),
        employeeId: directEmployeeId,
        employeeWhere,
        payrollId: query.payrollId,
        type: query.type,
        from: query.from,
        to: query.to,
        dateMode: query.dateMode === "cycle" ? "cycle" : "entry",
      }),
      includeSummary
        ? LedgerRepository.getActiveStatementSummary({
            employeeWhere,
            from: query.from,
            to: query.to,
            dateMode: query.dateMode === "cycle" ? "cycle" : "entry",
          })
        : Promise.resolve(undefined),
    ]);
    const { data, pagination } = buildCursorPaginationMeta(entries, limit);

    return {
      data: await this.enrichEntries(data),
      pagination,
      summary,
    };
  }

  static async detail(id: string, authUser: { id: string; role: Role }) {
    const entry = await LedgerRepository.findById(id);

    if (!entry) {
      throw new Error("Ledger entry not found");
    }

    if (authUser.role === Role.USER && entry.employeeId !== authUser.id) {
      throw new Error("You do not have permission to view this ledger entry");
    }

    if (authUser.role === Role.ADMIN && entry.employee) {
      ensureEmployeeAccess(entry.employee.role, authUser.role);
    }

    const [enrichedEntry] = await this.enrichEntries([entry]);

    return enrichedEntry;
  }

  static async myLedger(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const cacheKey = CacheService.buildKey(
      LEDGER_READ_CACHE_PREFIX,
      "my",
      employeeId,
      query.from ?? "all",
      query.to ?? "all",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [entries, total, summary] = await Promise.all([
      LedgerRepository.listByEmployee(employeeId, {
        skip,
        take,
        from: query.from,
        to: query.to,
      }),
      LedgerRepository.countByEmployee(employeeId, {
        from: query.from,
        to: query.to,
      }),
      this.getEmployeeSummaryCached(employeeId, query),
    ]);

    const result = {
      data: await this.enrichEntries(entries),
      pagination: buildPaginationMeta(total, page, limit),
      summary,
    };

    void CacheService.set(cacheKey, result, LEDGER_READ_CACHE_TTL);

    return result;
  }

  static async employeeLedger(
    employeeId: string,
    currentRole: Role,
    query: any,
  ) {
    const employee = await LedgerRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureEmployeeAccess(employee.role, currentRole);

    const { page, limit, skip, take } = getPagination(query);
    const cacheKey = CacheService.buildKey(
      LEDGER_READ_CACHE_PREFIX,
      "employee",
      employeeId,
      query.from ?? "all",
      query.to ?? "all",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [entries, total, summary] = await Promise.all([
      LedgerRepository.listByEmployee(employeeId, {
        skip,
        take,
        from: query.from,
        to: query.to,
      }),
      LedgerRepository.countByEmployee(employeeId, {
        from: query.from,
        to: query.to,
      }),
      this.getEmployeeSummaryCached(employeeId, query),
    ]);

    const result = {
      data: await this.enrichEntries(entries),
      pagination: buildPaginationMeta(total, page, limit),
      summary,
    };

    void CacheService.set(cacheKey, result, LEDGER_READ_CACHE_TTL);

    return result;
  }

  static async payrollLedger(payrollId: string, currentRole: Role, query: any) {
    const payroll = await LedgerRepository.findPayroll(payrollId);

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    ensureEmployeeAccess(payroll.employee.role, currentRole);

    const { page, limit, skip, take } = getPagination(query);
    const [entries, total] = await Promise.all([
      LedgerRepository.listByPayroll(payrollId, { skip, take }),
      LedgerRepository.countByPayroll(payrollId),
    ]);

    return {
      data: await this.enrichEntries(entries),
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
