import { prisma } from "../../config/prisma";
import { EmployeeStatus, PayrollStatus, SalaryType } from "@prisma/client";

export class SchedulerRepository {
  static getActiveEmployees() {
    return prisma.employee.findMany({
      where: {
        status: EmployeeStatus.ACTIVE,
      },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        salaryType: true,
        joiningDate: true,
        role: true,
        status: true,
      },
      orderBy: {
        employeeCode: "asc",
      },
    });
  }

  static getSystemSetting() {
    return prisma.systemSetting.findFirst();
  }

  static findPayroll(employeeId: string, periodStart: Date, periodEnd: Date) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart,
        periodEnd,
        status: {
          in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
        },
      },
    });
  }

  static getLatestPayroll(employeeId: string) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        status: {
          in: [
            PayrollStatus.GENERATED,
            PayrollStatus.PAID,
            PayrollStatus.SUPERSEDED,
          ],
        },
      },
      orderBy: {
        periodEnd: "desc",
      },
    });
  }

  static getFirstSalaryHistory(employeeId: string) {
    return prisma.salaryHistory.findFirst({
      where: {
        employeeId,
      },
      orderBy: {
        effectiveFrom: "asc",
      },
    });
  }

  static createRun(data: {
    name: string;
    startedAt: Date;
    success: boolean;
    metadata?: any;
  }) {
    return prisma.schedulerRun.create({
      data,
    });
  }

  static updateRun(
    id: string,
    data: {
      finishedAt: Date;
      success: boolean;
      errorMessage?: string;
      metadata?: any;
    },
  ) {
    return prisma.schedulerRun.update({
      where: { id },
      data,
    });
  }

  static listRuns(params: { skip: number; take: number }) {
    return prisma.$transaction([
      prisma.schedulerRun.findMany({
        skip: params.skip,
        take: params.take,
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.schedulerRun.count(),
    ]);
  }
}
