import { prisma, readPrisma } from "../../config/prisma";
import { AttendanceStatus, PayrollStatus, Prisma } from "@prisma/client";

const stripUndefined = (data: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

export class AttendanceRepository {
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

  static findEmployeeForRead(employeeId: string) {
    return readPrisma.employee.findUnique({
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

  static findEmployeesByIds(employeeIds: string[]) {
    return prisma.employee.findMany({
      where: {
        id: {
          in: employeeIds,
        },
      },
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

  static findById(id: string) {
    return readPrisma.attendance.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            role: true,
            status: true,
            joiningDate: true,
          },
        },
      },
    });
  }

  static findByEmployeeAndDate(employeeId: string, date: Date) {
    return prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
    });
  }

  static findByEmployeeAndDates(
    records: { employeeId: string; date: Date }[],
  ) {
    return prisma.attendance.findMany({
      where: {
        OR: records.map((record) => ({
          employeeId: record.employeeId,
          date: record.date,
        })),
      },
    });
  }

  static findManyByIdsForWrite(attendanceIds: string[]) {
    return prisma.attendance.findMany({
      where: {
        id: {
          in: attendanceIds,
        },
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            role: true,
            status: true,
            joiningDate: true,
          },
        },
      },
    });
  }

  static findActivePayrollLocks(params: {
    employeeIds: string[];
    minDate: Date;
    maxDate: Date;
  }) {
    const maxLockDate = new Date(params.maxDate);
    maxLockDate.setUTCDate(maxLockDate.getUTCDate() + 1);

    return prisma.payroll.findMany({
      where: {
        employeeId: {
          in: params.employeeIds,
        },
        status: {
          in: [PayrollStatus.GENERATED, PayrollStatus.PAID],
        },
        periodStart: {
          lte: maxLockDate,
        },
        periodEnd: {
          gte: params.minDate,
        },
      },
      select: {
        employeeId: true,
        salaryType: true,
        periodStart: true,
        periodEnd: true,
      },
    });
  }

  static create(data: {
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    otStartTime?: Date | null;
    otEndTime?: Date | null;
    otHours?: number;
    otManualOverride?: boolean;
    otOverrideReason?: string | null;
    otBreakdown?: any;
  }) {
    return prisma.attendance.create({
      data,
    });
  }

  static createMany(
    records: {
      employeeId: string;
      date: Date;
      status: AttendanceStatus;
      checkInTime?: Date | null;
      checkOutTime?: Date | null;
      otStartTime?: Date | null;
      otEndTime?: Date | null;
      otHours?: number;
      otManualOverride?: boolean;
      otOverrideReason?: string | null;
      otBreakdown?: any;
    }[],
  ) {
    return prisma.attendance.createManyAndReturn({
      data: records,
    });
  }

  static upsert(data: {
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    otStartTime?: Date | null;
    otEndTime?: Date | null;
    otHours?: number;
    otManualOverride?: boolean;
    otOverrideReason?: string | null;
    otBreakdown?: any;
  }) {
    return prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: data.date,
        },
      },
      update: stripUndefined({
        status: data.status,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        otStartTime: data.otStartTime,
        otEndTime: data.otEndTime,
        otHours: data.otHours,
        otManualOverride: data.otManualOverride,
        otOverrideReason: data.otOverrideReason,
        otBreakdown: data.otBreakdown,
      }),
      create: data,
    });
  }

  static list(params: {
    employeeId?: string;
    status?: AttendanceStatus;
    from?: Date;
    to?: Date;
    take: number;
    cursor?: string;
  }) {
    const where = {
      ...(params.employeeId && { employeeId: params.employeeId }),
      ...(params.status && { status: params.status }),
      ...(params.from &&
        params.to && {
          date: {
            gte: params.from,
            lte: params.to,
          },
      }),
    };

    return readPrisma.attendance.findMany({
      where,
      take: params.take,
      ...(params.cursor
        ? {
            skip: 1,
            cursor: { id: params.cursor },
          }
        : {}),
      select: {
        id: true,
        employeeId: true,
        date: true,
        status: true,
        checkInTime: true,
        checkOutTime: true,
        otHours: true,
        otStartTime: true,
        otEndTime: true,
        otManualOverride: true,
        otOverrideReason: true,
        lockedByPayrollId: true,
        createdAt: true,
        updatedAt: true,
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
    });
  }

  static listWithCount(params: {
    employeeId?: string;
    status?: AttendanceStatus;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where = {
      ...(params.employeeId && { employeeId: params.employeeId }),
      ...(params.status && { status: params.status }),
      ...(params.from &&
        params.to && {
          date: {
            gte: params.from,
            lte: params.to,
          },
        }),
    };

    return Promise.all([
      readPrisma.attendance.findMany({
        where,
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          employeeId: true,
          date: true,
          status: true,
          checkInTime: true,
          checkOutTime: true,
          otHours: true,
          otStartTime: true,
          otEndTime: true,
          otManualOverride: true,
          otOverrideReason: true,
          lockedByPayrollId: true,
          createdAt: true,
          updatedAt: true,
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
      readPrisma.attendance.count({ where }),
    ]);
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.attendance.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { date: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return readPrisma.attendance.count({
      where: { employeeId },
    });
  }

  static listByRange(
    employeeId: string,
    from: Date,
    to: Date,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          gte: from,
          lte: to,
        },
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { date: "asc" },
    });
  }

  static countByRange(
    employeeId: string,
    from: Date,
    to: Date,
  ) {
    return readPrisma.attendance.count({
      where: {
        employeeId,
        date: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  static listLatestRequestsByRange(
    employeeId: string,
    from: Date,
    to: Date,
  ) {
    return readPrisma.attendanceRequest.findMany({
      where: {
        employeeId,
        attendanceDate: {
          gte: from,
          lte: to,
        },
      },
      select: {
        id: true,
        employeeId: true,
        attendanceDate: true,
        oldStatus: true,
        requestedStatus: true,
        requestType: true,
        reason: true,
        status: true,
        requestedById: true,
        approvedById: true,
        approvedAt: true,
        rejectionReason: true,
        requestedCheckInTime: true,
        requestedCheckOutTime: true,
        requestedOtStartTime: true,
        requestedOtEndTime: true,
        requestedOtHours: true,
        requestedOtManualOverride: true,
        requestedOtOverrideReason: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        {
          attendanceDate: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });
  }

  static update(id: string, data: { status: AttendanceStatus } & Record<string, any>) {
    return prisma.attendance.update({
      where: { id },
      data,
    });
  }

  static delete(id: string) {
    return prisma.attendance.delete({
      where: { id },
    });
  }

  static updateMany(
    records: {
      attendanceId: string;
      status: AttendanceStatus;
      checkInTime?: Date | null;
      checkOutTime?: Date | null;
      otStartTime?: Date | null;
      otEndTime?: Date | null;
      otHours?: number;
      otManualOverride?: boolean;
      otOverrideReason?: string | null;
      otBreakdown?: any;
    }[],
  ) {
    if (records.length === 0) {
      return [];
    }

    const rows = records.map(
      (record) => Prisma.sql`(
        ${record.attendanceId}::text,
        ${record.status}::"AttendanceStatus",
        ${record.checkInTime ?? null}::timestamp,
        ${record.checkOutTime ?? null}::timestamp,
        ${record.otStartTime ?? null}::timestamp,
        ${record.otEndTime ?? null}::timestamp,
        ${record.otHours ?? 0}::numeric,
        ${record.otManualOverride ?? false}::boolean,
        ${record.otOverrideReason ?? null}::text,
        ${JSON.stringify(record.otBreakdown ?? null)}::jsonb
      )`,
    );

    return prisma.$queryRaw<any[]>`
      UPDATE "Attendance" AS attendance
      SET
        status = incoming.status,
        "checkInTime" = incoming."checkInTime",
        "checkOutTime" = incoming."checkOutTime",
        "otStartTime" = incoming."otStartTime",
        "otEndTime" = incoming."otEndTime",
        "otHours" = incoming."otHours",
        "otManualOverride" = incoming."otManualOverride",
        "otOverrideReason" = incoming."otOverrideReason",
        "otBreakdown" = incoming."otBreakdown",
        "updatedAt" = CURRENT_TIMESTAMP
      FROM (
        VALUES ${Prisma.join(rows)}
      ) AS incoming (
        id,
        status,
        "checkInTime",
        "checkOutTime",
        "otStartTime",
        "otEndTime",
        "otHours",
        "otManualOverride",
        "otOverrideReason",
        "otBreakdown"
      )
      WHERE attendance.id = incoming.id
      RETURNING attendance.*
    `;
  }

  static deleteMany(attendanceIds: string[]) {
    return prisma.attendance.deleteMany({
      where: {
        id: {
          in: attendanceIds,
        },
      },
    });
  }
}
