import {
  AttendanceRequestType,
  AttendanceStatus,
  Prisma,
  RequestStatus,
} from "@prisma/client";
import { prisma, readPrisma } from "../../config/prisma";
import { OvertimeService } from "../../services/overtime.service";

const stripUndefined = (data: Record<string, any>): Record<string, any> =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

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

  static findAttendancesByDates(employeeId: string, dates: Date[]) {
    return prisma.attendance.findMany({
      where: {
        employeeId,
        date: {
          in: dates,
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
    requestedCheckInTime?: Date | null;
    requestedCheckOutTime?: Date | null;
    requestedOtStartTime?: Date | null;
    requestedOtEndTime?: Date | null;
    requestedOtHours?: number | null;
    requestedOtManualOverride?: boolean;
    requestedOtOverrideReason?: string | null;
  }) {
    return prisma.attendanceRequest.create({
      data,
    });
  }

  static myRequests(employeeId: string) {
    return readPrisma.attendanceRequest.findMany({
      where: {
        employeeId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  static pendingRequests() {
    return readPrisma.attendanceRequest.findMany({
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
    requestedCheckInTime?: Date | null;
    requestedCheckOutTime?: Date | null;
    requestedOtStartTime?: Date | null;
    requestedOtEndTime?: Date | null;
    requestedOtHours?: number | null;
    requestedOtManualOverride?: boolean;
    requestedOtOverrideReason?: string | null;
    otStartTime?: Date | null;
    otEndTime?: Date | null;
    otHours?: number;
    otManualOverride?: boolean;
    otOverrideReason?: string | null;
    otBreakdown?: any;
  }) {
    return prisma.$transaction(async (tx) => {
      const ot = await OvertimeService.calculateForAttendance(stripUndefined({
        attendanceDate: params.attendanceDate,
        checkInTime: params.requestedCheckInTime,
        checkOutTime: params.requestedCheckOutTime,
        otStartTime: params.requestedOtStartTime,
        otEndTime: params.requestedOtEndTime,
        otHours: params.requestedOtHours,
        otManualOverride: params.requestedOtManualOverride,
        otOverrideReason: params.requestedOtOverrideReason,
      }) as any);

      const attendance = await tx.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: params.employeeId,
            date: params.attendanceDate,
          },
        },
        update: stripUndefined({
          status: params.requestedStatus,
          checkInTime: params.requestedCheckInTime,
          checkOutTime: params.requestedCheckOutTime,
          otStartTime: ot.otStartTime,
          otEndTime: ot.otEndTime,
          otHours: ot.otHours,
          otManualOverride: ot.otManualOverride,
          otOverrideReason: ot.otOverrideReason,
          otBreakdown: ot.otBreakdown,
        }),
        create: stripUndefined({
          employeeId: params.employeeId,
          date: params.attendanceDate,
          status: params.requestedStatus,
          checkInTime: params.requestedCheckInTime,
          checkOutTime: params.requestedCheckOutTime,
          otStartTime: ot.otStartTime,
          otEndTime: ot.otEndTime,
          otHours: ot.otHours,
          otManualOverride: ot.otManualOverride,
          otOverrideReason: ot.otOverrideReason,
          otBreakdown: ot.otBreakdown,
        }) as any,
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
      requestedCheckInTime?: Date | null;
      requestedCheckOutTime?: Date | null;
      requestedOtStartTime?: Date | null;
      requestedOtEndTime?: Date | null;
      requestedOtHours?: number | null;
      requestedOtManualOverride?: boolean;
      requestedOtOverrideReason?: string | null;
    }[],
  ) {
    return prisma.attendanceRequest.createManyAndReturn({
      data: records.map((record) => stripUndefined(record) as any),
    });
  }

  static deleteOwnPendingRequest(requestId: string) {
    return prisma.attendanceRequest.delete({
      where: { id: requestId },
    });
  }

  static findPendingRequestsByDates(employeeId: string, dates: Date[]) {
    return readPrisma.attendanceRequest.findMany({
      where: {
        employeeId,
        attendanceDate: {
          in: dates,
        },
        status: "PENDING",
      },
    });
  }

  static myRequestStatusCounts(employeeId: string) {
    return readPrisma.attendanceRequest.groupBy({
      by: ["status"],
      where: { employeeId },
      _count: true,
    });
  }

  static myRequestRangeStatusCounts(
    employeeId: string,
    from?: Date,
    to?: Date,
  ) {
    return readPrisma.attendanceRequest.groupBy({
      by: ["status"],
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
      _count: true,
    });
  }

  static pendingRequestsAll(params: {
    employeeWhere?: Prisma.EmployeeWhereInput;
    employeeId?: string;
  }) {
    return readPrisma.attendanceRequest.count({
      where: {
        status: "PENDING",
        ...(params.employeeId
          ? { employeeId: params.employeeId }
          : params.employeeWhere && { employee: params.employeeWhere }),
      },
    });
  }

  static pendingRequestsByEmployee(employeeId: string) {
    return readPrisma.attendanceRequest.findMany({
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
    return readPrisma.attendanceRequest.findMany({
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

  static pendingRequestsWithFilter(
    params: {
      employeeWhere?: Prisma.EmployeeWhereInput;
      employeeId?: string;
      from?: Date;
      to?: Date;
    },
    pagination?: { skip: number; take: number },
  ) {
    return readPrisma.attendanceRequest.findMany({
      where: {
        status: "PENDING",
        ...(params.employeeId
          ? { employeeId: params.employeeId }
          : params.employeeWhere && { employee: params.employeeWhere }),
        ...(params.from &&
          params.to && {
            attendanceDate: {
              gte: params.from,
              lte: params.to,
            },
          }),
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
    employeeId?: string;
    from?: Date;
    to?: Date;
  }) {
    return readPrisma.attendanceRequest.count({
      where: {
        status: "PENDING",
        ...(params.employeeId
          ? { employeeId: params.employeeId }
          : params.employeeWhere && { employee: params.employeeWhere }),
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

  static async approveMany(params: {
    requests: {
      id: string;
      employeeId: string;
      attendanceDate: Date;
      requestedStatus: AttendanceStatus;
      requestedCheckInTime: Date | null;
      requestedCheckOutTime: Date | null;
      requestedOtStartTime: Date | null;
      requestedOtEndTime: Date | null;
      requestedOtHours: Prisma.Decimal | null;
      requestedOtManualOverride: boolean;
      requestedOtOverrideReason: string | null;
    }[];
    approvedById: string;
  }) {
    const dates = params.requests.map((request) => request.attendanceDate);
    const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
    const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
    const settings = await OvertimeService.getSettingsForDateRange(
      minDate,
      maxDate,
    );
    const preparedAttendances = await Promise.all(
      params.requests.map(async (request) => {
        const setting = OvertimeService.resolveSettingFromList(
          settings,
          request.attendanceDate,
        );
        const ot = await OvertimeService.calculateForAttendance(stripUndefined({
          attendanceDate: request.attendanceDate,
          checkInTime: request.requestedCheckInTime,
          checkOutTime: request.requestedCheckOutTime,
          otStartTime: request.requestedOtStartTime,
          otEndTime: request.requestedOtEndTime,
          otHours:
            request.requestedOtHours === null
              ? null
              : Number(request.requestedOtHours ?? 0),
          otManualOverride: request.requestedOtManualOverride,
          otOverrideReason: request.requestedOtOverrideReason,
          setting,
        }) as any);

        return {
          request,
          ot,
        };
      }),
    );
    const approvedAt = new Date();
    const transactions = preparedAttendances.map(({ request, ot }) =>
      prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: request.employeeId,
              date: request.attendanceDate,
            },
          },
          update: stripUndefined({
          status: request.requestedStatus,
          checkInTime: request.requestedCheckInTime,
          checkOutTime: request.requestedCheckOutTime,
          otStartTime: ot.otStartTime,
          otEndTime: ot.otEndTime,
          otHours: ot.otHours,
          otManualOverride: ot.otManualOverride,
          otOverrideReason: ot.otOverrideReason,
          otBreakdown: ot.otBreakdown,
        }),
          create: stripUndefined({
            employeeId: request.employeeId,
            date: request.attendanceDate,
          status: request.requestedStatus,
          checkInTime: request.requestedCheckInTime,
          checkOutTime: request.requestedCheckOutTime,
          otStartTime: ot.otStartTime,
          otEndTime: ot.otEndTime,
          otHours: ot.otHours,
          otManualOverride: ot.otManualOverride,
          otOverrideReason: ot.otOverrideReason,
          otBreakdown: ot.otBreakdown,
        }) as any,
      }),
    );

    const results = await prisma.$transaction([
      ...transactions,
      prisma.attendanceRequest.updateMany({
        where: {
          id: {
            in: params.requests.map((request) => request.id),
          },
        },
        data: {
          status: "APPROVED",
          approvedById: params.approvedById,
          approvedAt,
        },
      }),
    ]);

    return {
      attendanceResults: results.slice(0, -1),
      updatedRequests: results.at(-1),
    };
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
