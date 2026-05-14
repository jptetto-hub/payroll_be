import { prisma } from "../../config/prisma";
import { AttendanceStatus, Prisma } from "@prisma/client";

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
    return prisma.attendance.findUnique({
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
  }) {
    return prisma.attendance.create({
      data,
    });
  }

  static upsert(data: {
    employeeId: string;
    date: Date;
    status: AttendanceStatus;
  }) {
    return prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: data.employeeId,
          date: data.date,
        },
      },
      update: {
        status: data.status,
      },
      create: data,
    });
  }

  static list(params: {
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

    return prisma.$transaction([
      prisma.attendance.findMany({
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
      prisma.attendance.count({ where }),
    ]);
  }

  static listByEmployee(
    employeeId: string,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.attendance.findMany({
      where: { employeeId },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: { date: "desc" },
    });
  }

  static countByEmployee(employeeId: string) {
    return prisma.attendance.count({
      where: { employeeId },
    });
  }

  static listByRange(
    employeeWhere: Prisma.EmployeeWhereInput,
    from: Date,
    to: Date,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.attendance.findMany({
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
    return prisma.attendance.count({
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
    return prisma.attendanceRequest.findMany({
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

  static update(id: string, status: AttendanceStatus) {
    return prisma.attendance.update({
      where: { id },
      data: { status },
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
    }[],
  ) {
    return prisma.$transaction(
      records.map((record) =>
        prisma.attendance.update({
          where: { id: record.attendanceId },
          data: { status: record.status },
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
