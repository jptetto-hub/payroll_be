import { LedgerType, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class LedgerRepository {
  static async getLastBalance(employeeId: string) {
    const last = await prisma.ledgerEntry.findFirst({
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

  static listAll(params: {
    skip: number;
    take: number;
    employeeWhere?: Prisma.EmployeeWhereInput;
    payrollId?: string;
    type?: LedgerType;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.payrollId && { payrollId: params.payrollId }),
      ...(params.type && { type: params.type }),
    };

    return prisma.$transaction([
      prisma.ledgerEntry.findMany({
        where,
        skip: params.skip,
        take: params.take,
        include: {
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              phone: true,
              salaryType: true,
            },
          },
          payroll: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.ledgerEntry.count({ where }),
    ]);
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.ledgerEntry.findMany({
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
    return prisma.ledgerEntry.count({
      where: { employeeId },
    });
  }

  static listByPayroll(
    payrollId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.ledgerEntry.findMany({
      where: { payrollId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "asc" },
    });
  }

  static countByPayroll(payrollId: string) {
    return prisma.ledgerEntry.count({
      where: { payrollId },
    });
  }

  static findEmployee(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  static findPayroll(payrollId: string) {
    return prisma.payroll.findUnique({
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
