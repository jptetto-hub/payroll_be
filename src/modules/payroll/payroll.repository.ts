import { prisma, readPrisma } from "../../config/prisma";
import { PayrollStatus, Prisma } from "@prisma/client";
import { CacheService } from "../../utils/cache";

const SYSTEM_SETTINGS_CACHE_KEY = "settings:system";
const SETTINGS_CACHE_TTL = 60 * 10;
const payrollListSelect = {
  id: true,
  employeeId: true,
  periodStart: true,
  periodEnd: true,
  salaryType: true,
  grossSalary: true,
  standardSalary: true,
  otTotalHours: true,
  otEarnings: true,
  lateMinutes: true,
  lateDeduction: true,
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
} satisfies Prisma.PayrollSelect;

const buildDateRange = (search: string) => {
  const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(search);
  const parsed = dateOnlyMatch
    ? new Date(`${search}T00:00:00.000Z`)
    : new Date(search);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const start = new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return { gte: start, lte: end };
};

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
        advanceDeductionMode: true,
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
    employeeId?: string;
    employeeWhere?: Prisma.EmployeeWhereInput;
    status?: PayrollStatus;
    search?: string;
    from?: Date;
    to?: Date;
  }) {
    const search = params.search?.trim();
    const normalizedSearch = search?.toUpperCase();
    const numericSearch =
      search && /^-?\d+(\.\d+)?$/.test(search) ? Number(search) : undefined;
    const integerSearch =
      numericSearch !== undefined && Number.isInteger(numericSearch)
        ? numericSearch
        : undefined;
    const dateRange = search ? buildDateRange(search) : undefined;
    const searchFilters: Prisma.PayrollWhereInput[] = search
      ? [
          { id: { contains: search, mode: "insensitive" } },
          { employeeId: { contains: search, mode: "insensitive" } },
          { activePayrollKey: { contains: search, mode: "insensitive" } },
          { recalculatedBy: { contains: search, mode: "insensitive" } },
          {
            recalculationReason: { contains: search, mode: "insensitive" },
          },
          { replacedPayrollId: { contains: search, mode: "insensitive" } },
          { cancelledById: { contains: search, mode: "insensitive" } },
          { cancelReason: { contains: search, mode: "insensitive" } },
          {
            employee: {
              name: { contains: search, mode: "insensitive" },
            },
          },
          {
            employee: {
              employeeCode: { contains: search, mode: "insensitive" },
            },
          },
          {
            employee: {
              department: { contains: search, mode: "insensitive" },
            },
          },
          {
            employee: {
              designation: { contains: search, mode: "insensitive" },
            },
          },
          {
            employee: {
              phone: { contains: search },
            },
          },
        ]
      : [];

    if (normalizedSearch === "MONTHLY" || normalizedSearch === "WEEKLY") {
      searchFilters.push({ salaryType: normalizedSearch });
    }

    if (
      normalizedSearch === "GENERATED" ||
      normalizedSearch === "PAID" ||
      normalizedSearch === "SUPERSEDED" ||
      normalizedSearch === "CANCELLED"
    ) {
      searchFilters.push({ status: normalizedSearch });
    }

    if (normalizedSearch === "TRUE" || normalizedSearch === "FALSE") {
      searchFilters.push({ isRecalculated: normalizedSearch === "TRUE" });
    }

    if (integerSearch !== undefined) {
      searchFilters.push(
        { version: integerSearch },
        { totalDays: integerSearch },
        { workingDays: integerSearch },
      );
    }

    if (numericSearch !== undefined) {
      searchFilters.push(
        { grossSalary: numericSearch },
        { standardSalary: numericSearch },
        { otTotalHours: numericSearch },
        { otHourlyRate: numericSearch },
        { otEarnings: numericSearch },
        { advanceDeduction: numericSearch },
        { carryForwardApplied: numericSearch },
        { totalDeduction: numericSearch },
        { rawFinalSalary: numericSearch },
        { carryForwardDeduction: numericSearch },
        { finalSalary: numericSearch },
        { presentDays: numericSearch },
        { absentDays: numericSearch },
        { halfDays: numericSearch },
      );
    }

    if (dateRange) {
      searchFilters.push(
        { periodStart: dateRange },
        { periodEnd: dateRange },
        { recalculatedAt: dateRange },
        { lockedAt: dateRange },
        { cancelledAt: dateRange },
        { createdAt: dateRange },
        { updatedAt: dateRange },
      );
    }

    const where: Prisma.PayrollWhereInput = {
      ...(params.employeeId
        ? { employeeId: params.employeeId }
        : params.employeeWhere && { employee: params.employeeWhere }),
      ...(params.status && { status: params.status }),
      ...(params.from && {
        periodStart: {
          gte: params.from,
        },
      }),
      ...(params.to && {
        periodEnd: {
          lte: params.to,
        },
      }),
      ...(search && {
        OR: searchFilters,
      }),
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
      select: payrollListSelect,
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
            joiningDate: true,
          },
        },
        payslips: true,
        ledgerEntries: true,
      },
    });
  }

  static findByIdForRead(id: string) {
    return readPrisma.payroll.findUnique({
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
            joiningDate: true,
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
    filters?: {
      from?: Date;
      to?: Date;
    },
  ) {
    return readPrisma.payroll.findMany({
      where: {
        employeeId,
        ...(filters?.from && {
          periodStart: {
            gte: filters.from,
          },
        }),
        ...(filters?.to && {
          periodEnd: {
            lte: filters.to,
          },
        }),
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { createdAt: "desc" },
      select: payrollListSelect,
    });
  }

  static countByEmployee(
    employeeId: string,
    filters?: {
      from?: Date;
      to?: Date;
    },
  ) {
    return readPrisma.payroll.count({
      where: {
        employeeId,
        ...(filters?.from && {
          periodStart: {
            gte: filters.from,
          },
        }),
        ...(filters?.to && {
          periodEnd: {
            lte: filters.to,
          },
        }),
      },
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
    applyState?: (
      tx: any,
      result: { oldPayroll: any; newPayroll: any },
    ) => Promise<Record<string, unknown> | void>;
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
      const appliedState = params.applyState
        ? await params.applyState(tx, { oldPayroll, newPayroll })
        : undefined;

      return {
        oldPayroll,
        newPayroll,
        ...(appliedState ?? {}),
      };
    });
  }
}
