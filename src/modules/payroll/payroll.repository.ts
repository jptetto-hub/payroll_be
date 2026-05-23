import { prisma, readPrisma } from "../../config/prisma";
import { PayrollStatus, Prisma } from "@prisma/client";
import { CacheService } from "../../utils/cache";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;

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

  static async getSystemSetting() {
    const cached = await CacheService.get<any>(SYSTEM_SETTINGS_CACHE_KEY);

    if (cached) {
      return cached;
    }

    const setting = await prisma.systemSetting.findFirst();

    await CacheService.set(
      SYSTEM_SETTINGS_CACHE_KEY,
      setting,
      SETTINGS_CACHE_TTL,
    );

    return setting;
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

  static findByActivePayrollKey(activePayrollKey: string) {
    return prisma.payroll.findUnique({
      where: {
        activePayrollKey,
      },
      select: {
        id: true,
        status: true,
        version: true,
        periodStart: true,
        periodEnd: true,
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
    take: number;
    cursor?: string;
    employeeWhere?: Prisma.EmployeeWhereInput;
    status?: PayrollStatus;
  }) {
    const where = {
      ...(params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.status && { status: params.status }),
    };

    return readPrisma.payroll.findMany({
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
          periodStart: true,
          periodEnd: true,
          salaryType: true,
          grossSalary: true,
          standardSalary: true,
          otTotalHours: true,
          otEarnings: true,
          advanceDeduction: true,
          finalSalary: true,
          version: true,
          status: true,
          isRecalculated: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              employeeCode: true,
              name: true,
              department: true,
              designation: true,
              salaryType: true,
            },
          },
        },
      });
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
    return readPrisma.payroll.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return readPrisma.payroll.count({
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
          activePayrollKey: null,
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
