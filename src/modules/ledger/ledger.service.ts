import { LedgerType, Role } from "@prisma/client";
import { LedgerRepository } from "./ledger.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";

const ensureEmployeeAccess = (targetRole: Role, currentRole: Role) => {
  if (currentRole === Role.ADMIN && targetRole !== Role.USER) {
    throw new Error("ADMIN can access ledger only for USER employees");
  }
};

export class LedgerService {
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

    return LedgerRepository.create({
      employeeId: params.employeeId,
      type: LedgerType.ADVANCE,
      referenceId: params.advanceId,
      debit: params.amount,
      credit: 0,
      balance,
      date: params.date,
    });
  }

  static async createPayrollLedger(params: {
    employeeId: string;
    payrollId: string;
    grossSalary: number;
    standardSalary?: number;
    otEarnings?: number;
    advanceDeduction: number;
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

    if (params.advanceDeduction > 0) {
      balance -= params.advanceDeduction;

      const deductionEntry = await LedgerRepository.create({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.DEDUCTION,
        referenceId: params.payrollId,
        debit: params.advanceDeduction,
        credit: 0,
        balance,
        date: params.date,
      });

      entries.push(deductionEntry);
    }

    return entries;
  }

  static async createAdjustmentLedger(params: {
    employeeId: string;
    payrollId: string;
    oldFinalSalary: number;
    newFinalSalary: number;
    date: Date;
  }) {
    const difference = params.newFinalSalary - params.oldFinalSalary;

    if (difference === 0) {
      return null;
    }

    let balance = await LedgerRepository.getLastBalance(params.employeeId);

    if (difference > 0) {
      balance += difference;

      return LedgerRepository.create({
        employeeId: params.employeeId,
        payrollId: params.payrollId,
        type: LedgerType.ADJUSTMENT,
        referenceId: params.payrollId,
        debit: 0,
        credit: difference,
        balance,
        date: params.date,
      });
    }

    balance -= Math.abs(difference);

    return LedgerRepository.create({
      employeeId: params.employeeId,
      payrollId: params.payrollId,
      type: LedgerType.ADJUSTMENT,
      referenceId: params.payrollId,
      debit: Math.abs(difference),
      credit: 0,
      balance,
      date: params.date,
    });
  }

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const [entries, total] = await LedgerRepository.listAll({
      skip,
      take,
      employeeWhere,
      payrollId: query.payrollId,
      type: query.type,
    });

    return {
      data: entries,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async myLedger(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const [entries, total] = await Promise.all([
      LedgerRepository.listByEmployee(employeeId, { skip, take }),
      LedgerRepository.countByEmployee(employeeId),
    ]);

    return {
      data: entries,
      pagination: buildPaginationMeta(total, page, limit),
    };
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
    const [entries, total] = await Promise.all([
      LedgerRepository.listByEmployee(employeeId, { skip, take }),
      LedgerRepository.countByEmployee(employeeId),
    ]);

    return {
      data: entries,
      pagination: buildPaginationMeta(total, page, limit),
    };
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
      data: entries,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
