import { prisma } from "../../config/prisma";
import { PayrollStatus, Prisma } from "@prisma/client";

export class PayslipRepository {
  static findPayroll(payrollId: string) {
    return prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: {
            id: true,
            role: true,
            status: true,
            employeeCode: true,
            name: true,
            salaryType: true,
          },
        },
      },
    });
  }

  static findByPayroll(payrollId: string) {
    return prisma.payslip.findFirst({
      where: { payrollId },
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

  static createFromPayroll(payroll: any) {
    return prisma.payslip.create({
      data: {
        employeeId: payroll.employeeId,
        payrollId: payroll.id,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        totalDays: payroll.totalDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        halfDays: payroll.halfDays,
        salaryBreakdown: payroll.salaryBreakdown,
        advanceDeduction: payroll.advanceDeduction,
        finalSalary: payroll.finalSalary,
        payrollVersion: payroll.version,
        isRecalculated: payroll.isRecalculated,
      },
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
      },
    });
  }

  static listAll(params: {
    skip: number;
    take: number;
    employeeWhere?: Prisma.EmployeeWhereInput;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      payroll: {
        is: {
          status: {
            not: PayrollStatus.CANCELLED,
          },
        },
      },
    };

    return prisma.$transaction([
      prisma.payslip.findMany({
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
          payroll: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payslip.count({ where }),
    ]);
  }

  static findById(id: string) {
    return prisma.payslip.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            role: true,
            employeeCode: true,
            name: true,
            phone: true,
            department: true,
            designation: true,
            salaryType: true,
          },
        },
        payroll: true,
      },
    });
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.payslip.findMany({
      where: {
        employeeId,
        payroll: {
          is: {
            status: {
              not: PayrollStatus.CANCELLED,
            },
          },
        },
      },
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
    return prisma.payslip.count({
      where: {
        employeeId,
        payroll: {
          is: {
            status: {
              not: PayrollStatus.CANCELLED,
            },
          },
        },
      },
    });
  }
}
