import { LedgerType, Prisma } from "@prisma/client";
import { prisma, readPrisma } from "../../config/prisma";

export class LedgerRepository {
  static async getLastBalance(employeeId: string) {
    const last = await prisma.ledgerEntry.findFirst({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    return last ? Number(last.balance) : 0;
  }

  static async getLastBalanceTx(tx: any, employeeId: string) {
    const last = await tx.ledgerEntry.findFirst({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });

    return last ? Number(last.balance) : 0;
  }

  static create(data: {
    employeeId: string;
    payrollId?: string;
    type: LedgerType;
    referenceId?: string;
    debit?: number;
    credit?: number;
    balance: number;
    date: Date;
  }) {
    return prisma.ledgerEntry.create({
      data,
    });
  }

  static createManyTx(
    tx: any,
    data: {
      employeeId: string;
      payrollId?: string;
      type: LedgerType;
      referenceId?: string;
      debit?: number;
      credit?: number;
      balance: number;
      date: Date;
    }[],
  ) {
    return tx.ledgerEntry.createMany({
      data,
    });
  }

  static listAll(params: {
    take: number;
    cursor?: string;
    employeeWhere?: Prisma.EmployeeWhereInput;
    payrollId?: string;
    type?: LedgerType;
    from?: string;
    to?: string;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.payrollId && { payrollId: params.payrollId }),
      ...(params.type && { type: params.type }),
      ...((params.from || params.to) && {
        date: {
          ...(params.from && { gte: new Date(`${params.from}T00:00:00.000Z`) }),
          ...(params.to && { lte: new Date(`${params.to}T23:59:59.999Z`) }),
        },
      }),
    };

    return readPrisma.ledgerEntry.findMany({
        where,
        take: params.take,
        ...(params.cursor
          ? {
              skip: 1,
              cursor: { id: params.cursor },
            }
          : {}),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          employeeId: true,
          payrollId: true,
          type: true,
          referenceId: true,
          debit: true,
          credit: true,
          balance: true,
          date: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              salaryType: true,
            },
          },
          payroll: {
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              status: true,
              version: true,
            },
          },
        },
      });
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.ledgerEntry.findMany({
      where: { employeeId },
      include: {
        payroll: true,
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return readPrisma.ledgerEntry.count({
      where: { employeeId },
    });
  }

  static listByPayroll(
    payrollId: string,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.ledgerEntry.findMany({
      where: { payrollId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "asc" },
    });
  }

  static countByPayroll(payrollId: string) {
    return readPrisma.ledgerEntry.count({
      where: { payrollId },
    });
  }

  static findEmployee(employeeId: string) {
    return readPrisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  static findPayroll(payrollId: string) {
    return readPrisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: {
            id: true,
            role: true,
            status: true,
          },
        },
      },
    });
  }
}
