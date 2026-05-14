import {
  AttendanceRequestType,
  AttendanceStatus,
  Prisma,
  RequestStatus,
} from "@prisma/client";
import { prisma } from "../../config/prisma";

export class AttendanceRequestRepository {
  static findEmployee(employeeId: string) {
    return prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        role: true,
        status: true,
        joiningDate: true,
      },
    });
  }

  static findAttendance(employeeId: string, date: Date) {
    return prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date,
        },
      },
    });
  }

  static findPendingRequest(employeeId: string, date: Date) {
    return prisma.attendanceRequest.findFirst({
      where: {
        employeeId,
        attendanceDate: date,
        status: RequestStatus.PENDING,
      },
    });
  }

  static create(data: {
    employeeId: string;
    attendanceDate: Date;
    oldStatus?: AttendanceStatus | null;
    requestedStatus: AttendanceStatus;
    requestType: AttendanceRequestType;
    reason: string;
    requestedById: string;
  }) {
    return prisma.attendanceRequest.create({
      data,
    });
  }

  static myRequests(employeeId: string) {
    return prisma.attendanceRequest.findMany({
      where: {
        employeeId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static pendingRequests() {
    return prisma.attendanceRequest.findMany({
      where: {
        status: RequestStatus.PENDING,
      },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            name: true,
            phone: true,
            department: true,
            designation: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  static findById(id: string) {
    return prisma.attendanceRequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });
  }

  static approveRequest(params: {
    requestId: string;
    approvedById: string;
    employeeId: string;
    attendanceDate: Date;
    requestedStatus: AttendanceStatus;
  }) {
    return prisma.$transaction(async (tx) => {
      const attendance = await tx.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: params.employeeId,
            date: params.attendanceDate,
          },
        },
        update: {
          status: params.requestedStatus,
        },
        create: {
          employeeId: params.employeeId,
          date: params.attendanceDate,
          status: params.requestedStatus,
        },
      });

      const request = await tx.attendanceRequest.update({
        where: { id: params.requestId },
        data: {
          status: "APPROVED",
          approvedById: params.approvedById,
          approvedAt: new Date(),
        },
      });

      return {
        attendance,
        request,
      };
    });
  }

  static rejectRequest(params: {
    requestId: string;
    approvedById: string;
    rejectionReason: string;
  }) {
    return prisma.attendanceRequest.update({
      where: { id: params.requestId },
      data: {
        status: "REJECTED",
        approvedById: params.approvedById,
        approvedAt: new Date(),
        rejectionReason: params.rejectionReason,
      },
    });
  }

  static createMany(
    records: {
      employeeId: string;
      attendanceDate: Date;
      oldStatus?: AttendanceStatus | null;
      requestedStatus: AttendanceStatus;
      requestType: AttendanceRequestType;
      reason: string;
      requestedById: string;
    }[],
  ) {
    return prisma.$transaction(
      records.map((record) =>
        prisma.attendanceRequest.create({
          data: record,
        }),
      ),
    );
  }

  static deleteOwnPendingRequest(requestId: string) {
    return prisma.attendanceRequest.delete({
      where: { id: requestId },
    });
  }

  static findPendingRequestsByDates(employeeId: string, dates: Date[]) {
    return prisma.attendanceRequest.findMany({
      where: {
        employeeId,
        attendanceDate: {
          in: dates,
        },
        status: "PENDING",
      },
    });
  }

  static myRequestsAll(employeeId: string) {
    return prisma.attendanceRequest.findMany({
      where: { employeeId },
    });
  }

  static pendingRequestsAll(employeeWhere?: Prisma.EmployeeWhereInput) {
    return prisma.attendanceRequest.findMany({
      where: {
        status: "PENDING",
        ...(employeeWhere && { employee: employeeWhere }),
      },
    });
  }

  static pendingRequestsByEmployee(employeeId: string) {
    return prisma.attendanceRequest.findMany({
      where: {
        employeeId,
        status: "PENDING",
      },
    });
  }

  static myRequestsWithFilter(
    employeeId: string,
    from?: Date,
    to?: Date,
    pagination?: { skip: number; take: number },
  ) {
    return prisma.attendanceRequest.findMany({
      where: {
        employeeId,
        ...(from &&
          to && {
            attendanceDate: {
              gte: from,
              lte: to,
            },
          }),
      },
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: {
        attendanceDate: "asc",
      },
    });
  }

  static countMyRequestsWithFilter(employeeId: string, from?: Date, to?: Date) {
    return prisma.attendanceRequest.count({
      where: {
        employeeId,
        ...(from &&
          to && {
            attendanceDate: {
              gte: from,
              lte: to,
            },
          }),
      },
    });
  }

  static pendingRequestsWithFilter(
    params: {
      employeeWhere?: Prisma.EmployeeWhereInput;
      from?: Date;
      to?: Date;
    },
    pagination?: { skip: number; take: number },
  ) {
    return prisma.attendanceRequest.findMany({
      where: {
        status: "PENDING",
        ...(params.employeeWhere && { employee: params.employeeWhere }),
        ...(params.from &&
          params.to && {
            attendanceDate: {
              gte: params.from,
              lte: params.to,
            },
          }),
      },
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
      ...(pagination && {
        skip: pagination.skip,
        take: pagination.take,
      }),
      orderBy: {
        attendanceDate: "asc",
      },
    });
  }

  static countPendingRequestsWithFilter(params: {
    employeeWhere?: Prisma.EmployeeWhereInput;
    from?: Date;
    to?: Date;
  }) {
    return prisma.attendanceRequest.count({
      where: {
        status: "PENDING",
        ...(params.employeeWhere && { employee: params.employeeWhere }),
        ...(params.from &&
          params.to && {
            attendanceDate: {
              gte: params.from,
              lte: params.to,
            },
          }),
      },
    });
  }

  static findManyByIds(requestIds: string[]) {
    return prisma.attendanceRequest.findMany({
      where: {
        id: {
          in: requestIds,
        },
      },
      include: {
        employee: true,
      },
    });
  }

  static approveMany(params: { requestIds: string[]; approvedById: string }) {
    return prisma.$transaction(async (tx) => {
      const requests = await tx.attendanceRequest.findMany({
        where: {
          id: {
            in: params.requestIds,
          },
        },
      });

      const attendanceResults = [];

      for (const request of requests) {
        const attendance = await tx.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: request.employeeId,
              date: request.attendanceDate,
            },
          },
          update: {
            status: request.requestedStatus,
          },
          create: {
            employeeId: request.employeeId,
            date: request.attendanceDate,
            status: request.requestedStatus,
          },
        });

        attendanceResults.push(attendance);
      }

      const updatedRequests = await tx.attendanceRequest.updateMany({
        where: {
          id: {
            in: params.requestIds,
          },
        },
        data: {
          status: "APPROVED",
          approvedById: params.approvedById,
          approvedAt: new Date(),
        },
      });

      return {
        attendanceResults,
        updatedRequests,
      };
    });
  }

  static rejectMany(params: {
    requestIds: string[];
    approvedById: string;
    rejectionReason: string;
  }) {
    return prisma.attendanceRequest.updateMany({
      where: {
        id: {
          in: params.requestIds,
        },
      },
      data: {
        status: "REJECTED",
        approvedById: params.approvedById,
        approvedAt: new Date(),
        rejectionReason: params.rejectionReason,
      },
    });
  }
}
