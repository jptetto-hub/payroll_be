import { prisma } from "../../config/prisma";
import { PayrollStatus, Prisma } from "@prisma/client";

export class PayrollRepository {
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

  static findActivePayroll(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
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

  static getLatestVersion(
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ) {
    return prisma.payroll.findFirst({
      where: {
        employeeId,
        periodStart,
        periodEnd,
      },
      orderBy: {
        version: "desc",
      },
    });
  }

  static createPayroll(data: any) {
    return prisma.payroll.create({
      data,
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
  }

  static list(params: {
    skip: number;
    take: number;
    employeeWhere?: Prisma.EmployeeWhereInput;
    status?: PayrollStatus;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.status && { status: params.status }),
    };

    return prisma.$transaction([
      prisma.payroll.findMany({
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
      prisma.payroll.count({ where }),
    ]);
  }

  static findById(id: string) {
    return prisma.payroll.findUnique({
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
        payslips: true,
        ledgerEntries: true,
      },
    });
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.payroll.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return prisma.payroll.count({
      where: { employeeId },
    });
  }

  static updateStatus(id: string, status: PayrollStatus) {
    return prisma.payroll.update({
      where: { id },
      data: { status },
    });
  }

  static cancelPayroll(id: string) {
    return prisma.payroll.update({
      where: { id },
      data: {
        status: PayrollStatus.CANCELLED,
      },
    });
  }

  static recalculatePayroll(params: {
    oldPayrollId: string;
    newPayrollData: any;
  }) {
    return prisma.$transaction(async (tx) => {
      const oldPayroll = await tx.payroll.update({
        where: { id: params.oldPayrollId },
        data: {
          status: PayrollStatus.SUPERSEDED,
        },
      });

      const newPayroll = await tx.payroll.create({
        data: params.newPayrollData,
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

      return {
        oldPayroll,
        newPayroll,
      };
    });
  }
}
