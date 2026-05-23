import { prisma, readPrisma } from "../../config/prisma";
import { AttendanceStatus, Prisma } from "@prisma/client";

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
    employeeWhere: Prisma.EmployeeWhereInput,
    from: Date,
    to: Date,
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.attendance.findMany({
      where: {
        employee: employeeWhere,
        date: {
          gte: from,
          lte: to,
        },
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
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
      orderBy: { date: "asc" },
    });
  }

  static countByRange(
    employeeWhere: Prisma.EmployeeWhereInput,
    from: Date,
    to: Date,
  ) {
    return readPrisma.attendance.count({
      where: {
        employee: employeeWhere,
        date: {
          gte: from,
          lte: to,
        },
      },
    });
  }

  static listLatestRequestsByRange(
    employeeWhere: Prisma.EmployeeWhereInput,
    from: Date,
    to: Date,
  ) {
    return readPrisma.attendanceRequest.findMany({
      where: {
        employee: employeeWhere,
        attendanceDate: {
          gte: from,
          lte: to,
        },
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
    return prisma.$transaction(
      records.map((record) =>
        prisma.attendance.update({
          where: { id: record.attendanceId },
          data: stripUndefined({
            status: record.status,
            checkInTime: record.checkInTime,
            checkOutTime: record.checkOutTime,
            otStartTime: record.otStartTime,
            otEndTime: record.otEndTime,
            otHours: record.otHours,
            otManualOverride: record.otManualOverride,
            otOverrideReason: record.otOverrideReason,
            otBreakdown: record.otBreakdown,
          }),
        }),
      ),
    );
  }

  static deleteMany(attendanceIds: string[]) {
    return prisma.$transaction(
      attendanceIds.map((id) =>
        prisma.attendance.delete({
          where: { id },
        }),
      ),
    );
  }
}
