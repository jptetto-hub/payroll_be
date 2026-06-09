"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const client_1 = require("@prisma/client");
const ledger_repository_1 = require("./ledger.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const cursor_pagination_util_1 = require("../../shared/utils/cursor-pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const cache_1 = require("../../utils/cache");
const LEDGER_READ_CACHE_PREFIX = "ledger-read";
const LEDGER_READ_CACHE_TTL = 30;
const ensureEmployeeAccess = (targetRole, currentRole) => {
    if (currentRole === client_1.Role.ADMIN && targetRole !== client_1.Role.USER) {
        throw new Error("ADMIN can access ledger only for USER employees");
    }
};
const roundMoney = (amount) => Math.round(amount * 100) / 100;
const getPayrollRoundingAdjustment = (params) => {
    if (params.rawFinalSalary === undefined ||
        params.finalSalary === undefined ||
        params.rawFinalSalary < 0) {
        return 0;
    }
    return roundMoney(params.finalSalary - params.rawFinalSalary);
};
const getPayrollLedgerContribution = (params) => roundMoney(params.grossSalary + getPayrollRoundingAdjustment(params));
const getCycleStatement = (payroll) => {
    if (!payroll)
        return null;
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
const getRowCalculation = (entry, cycleStatement) => {
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
    const roundingMovement = roundMoney(Number(cycleStatement.payableAmount ?? 0) -
        Number(cycleStatement.rawFinalSalary ?? 0));
    switch (entry.type) {
        case client_1.LedgerType.SALARY:
            return {
                openingBalance: 0,
                movement: roundMoney(standardSalary || entryMovement),
                balanceAfterEntry: roundMoney(standardSalary || entryMovement),
                finalCycleBalance: cycleStatement.cycleBalance,
                formula: "0 + salary",
            };
        case client_1.LedgerType.OVERTIME:
            return {
                openingBalance: roundMoney(grossSalary - otEarnings),
                movement: roundMoney(otEarnings || entryMovement),
                balanceAfterEntry: grossSalary,
                finalCycleBalance: cycleStatement.cycleBalance,
                formula: "salary + OT",
            };
        case client_1.LedgerType.ADVANCE:
        case client_1.LedgerType.DEDUCTION:
            return {
                openingBalance: grossSalary,
                movement: roundMoney(-totalDeduction || entryMovement),
                balanceAfterEntry: cycleStatement.cycleBalance,
                finalCycleBalance: cycleStatement.cycleBalance,
                formula: "gross earning - recovery",
            };
        case client_1.LedgerType.ADJUSTMENT:
            return {
                openingBalance: cycleStatement.cycleBalance,
                movement: roundingMovement,
                balanceAfterEntry: roundingMovement === 0
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
class LedgerService {
    static invalidateReadCaches() {
        void cache_1.CacheService.delByPattern(`${LEDGER_READ_CACHE_PREFIX}:*`);
    }
    static async getEmployeeSummaryCached(employeeId, query) {
        const cacheKey = cache_1.CacheService.buildKey(LEDGER_READ_CACHE_PREFIX, "summary", employeeId, query.from ?? "all", query.to ?? "all");
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const summary = await ledger_repository_1.LedgerRepository.getActiveStatementSummary({
            employeeWhere: { id: employeeId },
            employeeId,
            from: query.from,
            to: query.to,
        });
        void cache_1.CacheService.set(cacheKey, summary, LEDGER_READ_CACHE_TTL);
        return summary;
    }
    static async createAdvanceLedger(params) {
        const lastBalance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        const balance = lastBalance - params.amount;
        const entry = await ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            type: client_1.LedgerType.ADVANCE,
            referenceId: params.advanceId,
            debit: params.amount,
            credit: 0,
            balance,
            date: params.date,
        });
        this.invalidateReadCaches();
        return entry;
    }
    static async createPayrollLedger(params) {
        const entries = [];
        let balance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        const standardSalary = params.standardSalary ?? params.grossSalary;
        const otEarnings = params.otEarnings ?? 0;
        balance += standardSalary;
        const salaryEntry = await ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            payrollId: params.payrollId,
            type: client_1.LedgerType.SALARY,
            referenceId: params.payrollId,
            debit: 0,
            credit: standardSalary,
            balance,
            date: params.date,
        });
        entries.push(salaryEntry);
        if (otEarnings > 0) {
            balance += otEarnings;
            const otEntry = await ledger_repository_1.LedgerRepository.create({
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: "OVERTIME",
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
            const roundingEntry = await ledger_repository_1.LedgerRepository.create({
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: client_1.LedgerType.ADJUSTMENT,
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
    static async createPayrollLedgerTx(tx, params) {
        const entries = [];
        const lastEntry = await ledger_repository_1.LedgerRepository.getLastEntryTx(tx, params.employeeId);
        let balance = lastEntry ? Number(lastEntry.balance) : 0;
        const standardSalary = params.standardSalary ?? params.grossSalary;
        const otEarnings = params.otEarnings ?? 0;
        balance += standardSalary;
        entries.push({
            employeeId: params.employeeId,
            payrollId: params.payrollId,
            type: client_1.LedgerType.SALARY,
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
                type: client_1.LedgerType.OVERTIME,
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
                type: client_1.LedgerType.ADJUSTMENT,
                referenceId: params.payrollId,
                debit: roundingAdjustment < 0 ? Math.abs(roundingAdjustment) : 0,
                credit: roundingAdjustment > 0 ? roundingAdjustment : 0,
                balance,
                date: params.date,
            });
        }
        const firstPostingTime = Math.max(Date.now(), lastEntry ? lastEntry.createdAt.getTime() + 1 : 0);
        return ledger_repository_1.LedgerRepository.createManyAndReturnTx(tx, entries.map((entry, index) => ({
            ...entry,
            createdAt: new Date(firstPostingTime + index),
        })));
    }
    static async createAdjustmentLedger(params) {
        const difference = roundMoney(getPayrollLedgerContribution({
            grossSalary: params.newGrossSalary,
            rawFinalSalary: params.newRawFinalSalary,
            finalSalary: params.newFinalSalary,
        }) -
            (params.oldPostedContribution ??
                getPayrollLedgerContribution({
                    grossSalary: params.oldGrossSalary,
                    rawFinalSalary: params.oldRawFinalSalary,
                    finalSalary: params.oldFinalSalary,
                })));
        if (difference === 0) {
            return null;
        }
        let balance = await ledger_repository_1.LedgerRepository.getLastBalance(params.employeeId);
        if (difference > 0) {
            balance += difference;
            const entry = await ledger_repository_1.LedgerRepository.create({
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: client_1.LedgerType.ADJUSTMENT,
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
        const entry = await ledger_repository_1.LedgerRepository.create({
            employeeId: params.employeeId,
            payrollId: params.payrollId,
            type: client_1.LedgerType.ADJUSTMENT,
            referenceId: params.payrollId,
            debit: Math.abs(difference),
            credit: 0,
            balance,
            date: params.date,
        });
        this.invalidateReadCaches();
        return entry;
    }
    static async createAdjustmentLedgerTx(tx, params) {
        const difference = roundMoney(getPayrollLedgerContribution({
            grossSalary: params.newGrossSalary,
            rawFinalSalary: params.newRawFinalSalary,
            finalSalary: params.newFinalSalary,
        }) -
            (params.oldPostedContribution ??
                getPayrollLedgerContribution({
                    grossSalary: params.oldGrossSalary,
                    rawFinalSalary: params.oldRawFinalSalary,
                    finalSalary: params.oldFinalSalary,
                })));
        if (difference === 0) {
            return null;
        }
        const lastEntry = await ledger_repository_1.LedgerRepository.getLastEntryTx(tx, params.employeeId);
        let balance = lastEntry ? Number(lastEntry.balance) : 0;
        const createdAt = new Date(Math.max(Date.now(), lastEntry ? lastEntry.createdAt.getTime() + 1 : 0));
        if (difference > 0) {
            balance += difference;
            return tx.ledgerEntry.create({
                data: {
                    employeeId: params.employeeId,
                    payrollId: params.payrollId,
                    type: client_1.LedgerType.ADJUSTMENT,
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
                type: client_1.LedgerType.ADJUSTMENT,
                referenceId: params.payrollId,
                debit: Math.abs(difference),
                credit: 0,
                balance,
                date: params.date,
                createdAt,
            },
        });
    }
    static async createPayrollPostingReversalTx(tx, params) {
        const postedEntries = await tx.ledgerEntry.findMany({
            where: {
                payrollId: params.payrollId,
            },
            select: {
                debit: true,
                credit: true,
            },
        });
        const postedContribution = roundMoney(postedEntries.reduce((sum, entry) => sum + Number(entry.credit) - Number(entry.debit), 0));
        if (postedContribution === 0) {
            return null;
        }
        const lastEntry = await ledger_repository_1.LedgerRepository.getLastEntryTx(tx, params.employeeId);
        const lastBalance = lastEntry ? Number(lastEntry.balance) : 0;
        const reversalAmount = Math.abs(postedContribution);
        const balance = roundMoney(lastBalance - postedContribution);
        return tx.ledgerEntry.create({
            data: {
                employeeId: params.employeeId,
                payrollId: params.payrollId,
                type: client_1.LedgerType.ADJUSTMENT,
                referenceId: params.payrollId,
                debit: postedContribution > 0 ? reversalAmount : 0,
                credit: postedContribution < 0 ? reversalAmount : 0,
                balance,
                date: params.date,
                createdAt: new Date(Math.max(Date.now(), lastEntry ? lastEntry.createdAt.getTime() + 1 : 0)),
            },
        });
    }
    static async enrichEntries(entries) {
        const advanceIds = Array.from(new Set(entries
            .filter((entry) => entry.type === client_1.LedgerType.ADVANCE && Boolean(entry.referenceId))
            .map((entry) => entry.referenceId)));
        const advances = advanceIds.length > 0
            ? await ledger_repository_1.LedgerRepository.findAdvancesByIds(advanceIds)
            : [];
        const advanceById = new Map(advances.map((advance) => [advance.id, advance]));
        const payrollIdsFromAdvances = advances
            .map((advance) => advance.lockedByPayrollId)
            .filter(Boolean);
        const payrollIds = Array.from(new Set(payrollIdsFromAdvances));
        const payrollsById = payrollIds.length > 0
            ? new Map((await ledger_repository_1.LedgerRepository.findPayrollsByIds(payrollIds)).map((payroll) => [payroll.id, payroll]))
            : new Map();
        const enrichedEntries = entries.map((entry) => {
            const advance = entry.type === client_1.LedgerType.ADVANCE
                ? advanceById.get(entry.referenceId)
                : undefined;
            const cyclePayroll = entry.payroll ?? payrollsById.get(advance?.lockedByPayrollId ?? "");
            const periodStart = entry.payroll?.periodStart ?? advance?.cycleStartDate;
            const periodEnd = entry.payroll?.periodEnd ?? advance?.cycleEndDate;
            const salaryType = entry.payroll?.salaryType ?? advance?.payCycleType;
            const isVoidedPayroll = entry.payroll?.status === client_1.PayrollStatus.CANCELLED ||
                entry.payroll?.status === client_1.PayrollStatus.SUPERSEDED;
            const isLegacyDeduction = entry.type === client_1.LedgerType.DEDUCTION;
            const expectedRoundingAdjustment = entry.payroll
                ? getPayrollRoundingAdjustment({
                    rawFinalSalary: Number(entry.payroll.rawFinalSalary),
                    finalSalary: Number(entry.payroll.finalSalary),
                })
                : 0;
            const entryMovement = roundMoney(Number(entry.credit) - Number(entry.debit));
            const isLegacyRecalculationAdjustment = entry.type === client_1.LedgerType.ADJUSTMENT &&
                Boolean(entry.payroll) &&
                !isVoidedPayroll &&
                Math.abs(entryMovement - expectedRoundingAdjustment) > 0.01;
            const includedInActiveBalance = !isVoidedPayroll &&
                !isLegacyDeduction &&
                !isLegacyRecalculationAdjustment;
            const narration = (() => {
                switch (entry.type) {
                    case client_1.LedgerType.SALARY:
                        return "Attendance-based salary credited for this payroll cycle.";
                    case client_1.LedgerType.OVERTIME:
                        return "Overtime earning credited for this payroll cycle.";
                    case client_1.LedgerType.ADVANCE:
                        return "Advance paid; recovery is shown in the selected payroll cycle breakdown.";
                    case client_1.LedgerType.DEDUCTION:
                        return "Historical payroll recovery debit entry.";
                    case client_1.LedgerType.ADJUSTMENT:
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
                payrollCycle: periodStart && periodEnd
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
                legacyWarning: isLegacyDeduction
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
    static async list(query, authUser) {
        const { limit, cursor } = (0, cursor_pagination_util_1.getCursorPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
            authUser,
            employeeId: query.employeeId,
        });
        const includeSummary = query.includeSummary === "true";
        const directEmployeeId = authUser.role === client_1.Role.USER
            ? authUser.id
            : query.employeeId && query.employeeId !== "all"
                ? query.employeeId
                : undefined;
        const [entries, summary] = await Promise.all([
            ledger_repository_1.LedgerRepository.listAll({
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
                ? ledger_repository_1.LedgerRepository.getActiveStatementSummary({
                    employeeWhere,
                    from: query.from,
                    to: query.to,
                    dateMode: query.dateMode === "cycle" ? "cycle" : "entry",
                })
                : Promise.resolve(undefined),
        ]);
        const { data, pagination } = (0, cursor_pagination_util_1.buildCursorPaginationMeta)(entries, limit);
        return {
            data: await this.enrichEntries(data),
            pagination,
            summary,
        };
    }
    static async detail(id, authUser) {
        const entry = await ledger_repository_1.LedgerRepository.findById(id);
        if (!entry) {
            throw new Error("Ledger entry not found");
        }
        if (authUser.role === client_1.Role.USER && entry.employeeId !== authUser.id) {
            throw new Error("You do not have permission to view this ledger entry");
        }
        if (authUser.role === client_1.Role.ADMIN && entry.employee) {
            ensureEmployeeAccess(entry.employee.role, authUser.role);
        }
        const [enrichedEntry] = await this.enrichEntries([entry]);
        return enrichedEntry;
    }
    static async myLedger(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = cache_1.CacheService.buildKey(LEDGER_READ_CACHE_PREFIX, "my", employeeId, query.from ?? "all", query.to ?? "all", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [entries, total, summary] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByEmployee(employeeId, {
                skip,
                take,
                from: query.from,
                to: query.to,
            }),
            ledger_repository_1.LedgerRepository.countByEmployee(employeeId, {
                from: query.from,
                to: query.to,
            }),
            this.getEmployeeSummaryCached(employeeId, query),
        ]);
        const result = {
            data: await this.enrichEntries(entries),
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
            summary,
        };
        void cache_1.CacheService.set(cacheKey, result, LEDGER_READ_CACHE_TTL);
        return result;
    }
    static async employeeLedger(employeeId, currentRole, query) {
        const employee = await ledger_repository_1.LedgerRepository.findEmployee(employeeId);
        if (!employee) {
            throw new Error("Employee not found");
        }
        ensureEmployeeAccess(employee.role, currentRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const cacheKey = cache_1.CacheService.buildKey(LEDGER_READ_CACHE_PREFIX, "employee", employeeId, query.from ?? "all", query.to ?? "all", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached) {
            return cached;
        }
        const [entries, total, summary] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByEmployee(employeeId, {
                skip,
                take,
                from: query.from,
                to: query.to,
            }),
            ledger_repository_1.LedgerRepository.countByEmployee(employeeId, {
                from: query.from,
                to: query.to,
            }),
            this.getEmployeeSummaryCached(employeeId, query),
        ]);
        const result = {
            data: await this.enrichEntries(entries),
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
            summary,
        };
        void cache_1.CacheService.set(cacheKey, result, LEDGER_READ_CACHE_TTL);
        return result;
    }
    static async payrollLedger(payrollId, currentRole, query) {
        const payroll = await ledger_repository_1.LedgerRepository.findPayroll(payrollId);
        if (!payroll) {
            throw new Error("Payroll not found");
        }
        ensureEmployeeAccess(payroll.employee.role, currentRole);
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const [entries, total] = await Promise.all([
            ledger_repository_1.LedgerRepository.listByPayroll(payrollId, { skip, take }),
            ledger_repository_1.LedgerRepository.countByPayroll(payrollId),
        ]);
        return {
            data: await this.enrichEntries(entries),
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
}
exports.LedgerService = LedgerService;
//# sourceMappingURL=ledger.service.js.map