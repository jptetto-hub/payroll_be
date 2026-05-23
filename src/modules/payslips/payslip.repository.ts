import { prisma, readPrisma } from "../../config/prisma";
import { PayrollStatus, PayslipStatus, Prisma } from "@prisma/client";

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
    return readPrisma.payslip.findUnique({
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
    return readPrisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  static createFromPayroll(payroll: any) {
    return prisma.payslip.upsert({
      where: {
        payrollId: payroll.id,
      },
      update: {
        totalDays: payroll.totalDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        halfDays: payroll.halfDays,
        salaryBreakdown: payroll.salaryBreakdown,
        standardSalary: payroll.standardSalary ?? payroll.grossSalary,
        otTotalHours: payroll.otTotalHours ?? 0,
        otHourlyRate: payroll.otHourlyRate ?? 0,
        otEarnings: payroll.otEarnings ?? 0,
        overtimeBreakdown: payroll.overtimeBreakdown ?? null,
        advanceDeduction: payroll.advanceDeduction,
        finalSalary: payroll.finalSalary,
        payrollVersion: payroll.version,
        isRecalculated: payroll.isRecalculated,
        status: PayslipStatus.READY,
        pdfGeneratedAt: new Date(),
        errorMessage: null,
      },
      create: {
        employeeId: payroll.employeeId,
        payrollId: payroll.id,
        periodStart: payroll.periodStart,
        periodEnd: payroll.periodEnd,
        totalDays: payroll.totalDays,
        presentDays: payroll.presentDays,
        absentDays: payroll.absentDays,
        halfDays: payroll.halfDays,
        salaryBreakdown: payroll.salaryBreakdown,
        standardSalary: payroll.standardSalary ?? payroll.grossSalary,
        otTotalHours: payroll.otTotalHours ?? 0,
        otHourlyRate: payroll.otHourlyRate ?? 0,
        otEarnings: payroll.otEarnings ?? 0,
        overtimeBreakdown: payroll.overtimeBreakdown ?? null,
        advanceDeduction: payroll.advanceDeduction,
        finalSalary: payroll.finalSalary,
        payrollVersion: payroll.version,
        isRecalculated: payroll.isRecalculated,
        status: PayslipStatus.READY,
        pdfGeneratedAt: new Date(),
        errorMessage: null,
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

  static findRetryTarget(id: string) {
    return prisma.payslip.findUnique({
      where: { id },
      select: {
        id: true,
        payrollId: true,
        status: true,
      },
    });
  }

  static markRetryQueued(id: string) {
    return prisma.payslip.update({
      where: { id },
      data: {
        status: PayslipStatus.PENDING,
        errorMessage: null,
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

    return Promise.all([
      readPrisma.payslip.findMany({
        where,
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          employeeId: true,
          payrollId: true,
          periodStart: true,
          periodEnd: true,
          totalDays: true,
          presentDays: true,
          absentDays: true,
          halfDays: true,
          standardSalary: true,
          otTotalHours: true,
          otEarnings: true,
          advanceDeduction: true,
          finalSalary: true,
          payrollVersion: true,
          isRecalculated: true,
          status: true,
          pdfUrl: true,
          pdfGeneratedAt: true,
          createdAt: true,
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
          payroll: {
            select: {
              id: true,
              status: true,
              salaryType: true,
              periodStart: true,
              periodEnd: true,
              version: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      readPrisma.payslip.count({ where }),
    ]);
  }

  static findById(id: string) {
    return readPrisma.payslip.findUnique({
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
    return readPrisma.payslip.findMany({
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
      select: {
        id: true,
        employeeId: true,
        payrollId: true,
        periodStart: true,
        periodEnd: true,
        totalDays: true,
        presentDays: true,
        absentDays: true,
        halfDays: true,
        standardSalary: true,
        otTotalHours: true,
        otEarnings: true,
        advanceDeduction: true,
        finalSalary: true,
        payrollVersion: true,
        isRecalculated: true,
        status: true,
        pdfUrl: true,
        pdfGeneratedAt: true,
        createdAt: true,
        payroll: {
          select: {
            id: true,
            status: true,
            salaryType: true,
            periodStart: true,
            periodEnd: true,
            version: true,
          },
        },
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return readPrisma.payslip.count({
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
