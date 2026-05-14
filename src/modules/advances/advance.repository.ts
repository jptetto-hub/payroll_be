import { prisma } from "../../config/prisma";
import { AdvanceSettlementStatus, Prisma, SalaryType } from "@prisma/client";

export class AdvanceRepository {
  static findEmployee(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        role: true,
        status: true,
        salaryType: true,
        joiningDate: true,
      },
    });
  }

  static getSystemSetting() {
    return prisma.systemSetting.findFirst();
  }

  static create(data: {
    employeeId: string;
    amount: number;
    date: Date;
    payCycleType: SalaryType;
    cycleStartDate: Date;
    cycleEndDate: Date;
    remainingAmount: number;
    isSettled: boolean;
    note?: string;
  }) {
    return prisma.advancePayment.create({
      data,
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
          },
        },
      },
    });
  }

  static findById(id: string) {
    return prisma.advancePayment.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            role: true,
            status: true,
            salaryType: true,
            joiningDate: true,
          },
        },
      },
    });
  }

  static listAll(params: {
    skip: number;
    take: number;
    employeeWhere?: Prisma.EmployeeWhereInput;
    isSettled?: boolean;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.isSettled !== undefined && { isSettled: params.isSettled }),
    };

    return prisma.$transaction([
      prisma.advancePayment.findMany({
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
              department: true,
              designation: true,
              salaryType: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.advancePayment.count({ where }),
    ]);
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.advancePayment.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { date: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return prisma.advancePayment.count({
      where: { employeeId },
    });
  }

  static listByCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return prisma.advancePayment.findMany({
      where: {
        employeeId,
        cycleStartDate,
        cycleEndDate,
      },
      orderBy: { date: "asc" },
    });
  }

  static findPayrollForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart: cycleStartDate,
        periodEnd: cycleEndDate,
      },
    });
  }

  static update(
    id: string,
    data: {
      amount?: number;
      remainingAmount?: number;
      date?: Date;
      cycleStartDate?: Date;
      cycleEndDate?: Date;
      note?: string;
    },
  ) {
    return prisma.advancePayment.update({
      where: { id },
      data,
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
          },
        },
      },
    });
  }

  static delete(id: string) {
    return prisma.advancePayment.delete({
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
          },
        },
      },
    });
  }

  static getSalaryForDate(employeeId: string, date: Date) {
    return prisma.salaryHistory.findFirst({
      where: {
        employeeId,
        effectiveFrom: {
          lte: date,
        },
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });
  }

  static getAdvancesForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
    excludeAdvanceId?: string,
  ) {
    return prisma.advancePayment.findMany({
      where: {
        employeeId,
        cycleStartDate,
        cycleEndDate,
        isSettled: false,
        ...(excludeAdvanceId && {
          id: {
            not: excludeAdvanceId,
          },
        }),
      },
    });
  }

  static getUnsettledAdvancesForCycle(
    employeeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ) {
    return prisma.advancePayment.findMany({
      where: {
        employeeId,
        cycleStartDate,
        cycleEndDate,
        isSettled: false,
      },
      orderBy: { date: "asc" },
    });
  }

  static settleAdvances(ids: string[]) {
    return prisma.$transaction(async (tx) => {
      const advances = await tx.advancePayment.findMany({
        where: {
          id: {
            in: ids,
          },
        },
      });

      await Promise.all(
        advances.map((advance) =>
          tx.advancePayment.update({
            where: { id: advance.id },
            data: {
              settledAmount: advance.amount,
              remainingAmount: 0,
              carryForwardAmount: 0,
              settlementStatus: AdvanceSettlementStatus.SETTLED,
              isSettled: true,
            },
          }),
        ),
      );

      return {
        count: advances.length,
      };
    });
  }
}
