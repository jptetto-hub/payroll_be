import { prisma, readPrisma } from "../../config/prisma";

export class SalaryHistoryRepository {
  static create(data: {
    employeeId: string;
    salaryAmount: number;
    effectiveFrom: Date;
  }) {
    return prisma.salaryHistory.create({ data });
  }

  static findById(id: string) {
    return prisma.salaryHistory.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            salaryType: true,
            status: true,
            joiningDate: true,
          },
        },
      },
    });
  }

  static findEmployee(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        salaryType: true,
        status: true,
        joiningDate: true,
      },
    });
  }

  static findEmployeeForRead(employeeId: string) {
    return readPrisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        salaryType: true,
        status: true,
        joiningDate: true,
      },
    });
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.salaryHistory.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { effectiveFrom: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return readPrisma.salaryHistory.count({
      where: { employeeId },
    });
  }

  static findByEmployeeAndEffectiveDate(
    employeeId: string,
    effectiveFrom: Date,
  ) {
    return prisma.salaryHistory.findFirst({
      where: {
        employeeId,
        effectiveFrom,
      },
    });
  }

  static getCurrentSalary(employeeId: string) {
    return readPrisma.salaryHistory.findFirst({
      where: {
        employeeId,
        effectiveFrom: {
          lte: new Date(),
        },
      },
      orderBy: {
        effectiveFrom: "desc",
      },
    });
  }

  static resolveSalaryByDate(employeeId: string, date: Date) {
    return readPrisma.salaryHistory.findFirst({
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

  static update(
    id: string,
    data: {
      salaryAmount?: number;
      effectiveFrom?: Date;
    },
  ) {
    return prisma.salaryHistory.update({
      where: { id },
      data,
    });
  }

  static delete(id: string) {
    return prisma.salaryHistory.delete({
      where: { id },
    });
  }

  static findPayrollUsingSalaryPeriod(employeeId: string, effectiveFrom: Date) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart: {
          lte: effectiveFrom,
        },
        periodEnd: {
          gte: effectiveFrom,
        },
      },
    });
  }
}
