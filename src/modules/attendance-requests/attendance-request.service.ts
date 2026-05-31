import {
  AttendanceRequestType,
  AttendanceStatus,
  Prisma,
  RequestStatus,
  Role,
} from "@prisma/client";
import { AttendanceRequestRepository } from "./attendance-request.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import {
  assertAttendanceApprovalNotLocked,
  assertAttendanceRequestNotLocked,
  isAttendanceDateLockedByPayroll,
} from "../../shared/payroll/payroll-lock.util";
import { CacheService } from "../../utils/cache";
import { AttendanceRepository } from "../attendance/attendance.repository";
import { getBusinessDate } from "../../shared/time/business-date.util";

const normalizeDate = (date: string) => {
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const ensureDateOnOrAfterJoining = (params: {
  date: Date;
  joiningDate: Date;
  action: string;
}) => {
  if (formatDate(params.date) < formatDate(params.joiningDate)) {
    throw new Error(
      `${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`,
    );
  }
};

const ensureNotFutureDate = (date: Date) => {
  if (date > getBusinessDate()) {
    throw new Error("Future attendance request is not allowed");
  }
};

const isSunday = (date: Date) => date.getUTCDay() === 0;

const ensureSundayRequestIsOtOnly = (
  attendanceDate: Date,
  item: {
    requestedCheckInTime?: string | null;
    requestedCheckOutTime?: string | null;
    requestedOtStartTime?: string | null;
    requestedOtEndTime?: string | null;
    requestedOtHours?: number | null;
  },
) => {
  if (!isSunday(attendanceDate)) {
    return;
  }

  const hasOt =
    Number(item.requestedOtHours ?? 0) > 0 ||
    Boolean(
      (item.requestedOtStartTime || item.requestedCheckInTime) &&
        (item.requestedOtEndTime || item.requestedCheckOutTime),
    );

  if (!hasOt) {
    throw new Error(
      "Sunday attendance is skipped. Submit OT start/end or OT hours only for Sunday.",
    );
  }
};

const parseOptionalDate = (value?: string) => {
  if (!value) return undefined;

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const parseOptionalDateTime = (value?: string | null) => {
  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date-time value");
  }

  return parsed;
};

const hasRequestedOtChange = (item: {
  requestedCheckInTime?: string | null;
  requestedCheckOutTime?: string | null;
  requestedOtStartTime?: string | null;
  requestedOtEndTime?: string | null;
  requestedOtHours?: number | null;
  requestedOtManualOverride?: boolean;
}) =>
  Boolean(
    item.requestedCheckInTime ||
      item.requestedCheckOutTime ||
      item.requestedOtStartTime ||
      item.requestedOtEndTime ||
      item.requestedOtHours !== undefined ||
      item.requestedOtManualOverride !== undefined,
  );

const requestHasOtChange = (request: {
  requestedCheckInTime?: Date | null;
  requestedCheckOutTime?: Date | null;
  requestedOtStartTime?: Date | null;
  requestedOtEndTime?: Date | null;
  requestedOtHours?: unknown;
  requestedOtManualOverride?: boolean | null;
}) =>
  Boolean(
    request.requestedCheckInTime ||
      request.requestedCheckOutTime ||
      request.requestedOtStartTime ||
      request.requestedOtEndTime ||
      request.requestedOtHours !== null ||
      request.requestedOtManualOverride,
  );

const groupByStatus = (requests: any[]) => {
  return {
    pending: requests.filter((item) => item.status === "PENDING"),
    approved: requests.filter((item) => item.status === "APPROVED"),
    rejected: requests.filter((item) => item.status === "REJECTED"),
  };
};

const countRequestedStatus = (requests: any[]) => {
  return {
    present: requests.filter((item) => item.requestedStatus === "PRESENT")
      .length,
    absent: requests.filter((item) => item.requestedStatus === "ABSENT").length,
    halfDay: requests.filter((item) => item.requestedStatus === "HALF_DAY")
      .length,
  };
};

const countGroupedStatus = (requests: any[], status: RequestStatus) =>
  Number(
    requests.find((item) => item.status === status)?._count ?? 0,
  );

const attendanceKey = (employeeId: string, date: Date) =>
  `${employeeId}_${formatDate(date)}`;

const invalidateAttendanceCaches = () => {
  void Promise.all([
    CacheService.delByPattern("attendance-read:*"),
    CacheService.delByPattern("attendance-requests-read:*"),
    CacheService.delByPattern("dashboard:*"),
    CacheService.delByPattern("dashboard-summary:*"),
    CacheService.delByPattern("attendance-summary:*"),
  ]);
};

const attendanceRequestReadCacheKey = (
  section: string,
  ...parts: Array<string | number | undefined>
) => CacheService.buildKey("attendance-requests-read", section, ...parts);

export class AttendanceRequestService {
  static async createRequest(
    data: {
      requests: {
        attendanceDate: string;
        requestedStatus: AttendanceStatus;
        requestType: AttendanceRequestType;
        reason: string;
        requestedCheckInTime?: string | null;
        requestedCheckOutTime?: string | null;
        requestedOtStartTime?: string | null;
        requestedOtEndTime?: string | null;
        requestedOtHours?: number | null;
        requestedOtManualOverride?: boolean;
        requestedOtOverrideReason?: string | null;
      }[];
    },
    currentUser: {
      id: string;
      role: Role;
    },
  ) {
    if (currentUser.role !== Role.USER) {
      throw new Error("Only USER can create attendance request");
    }

    const employee = await AttendanceRequestRepository.findEmployee(
      currentUser.id,
    );

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status !== "ACTIVE") {
      throw new Error("Inactive employee cannot create attendance request");
    }

    const seenDates = new Set<string>();

    for (const item of data.requests) {
      if (seenDates.has(item.attendanceDate)) {
        throw new Error(
          `Duplicate attendance date found: ${item.attendanceDate}`,
        );
      }

      seenDates.add(item.attendanceDate);
    }

    const normalizedDates = data.requests.map((item) =>
      normalizeDate(item.attendanceDate),
    );

    normalizedDates.forEach(ensureNotFutureDate);
    normalizedDates.forEach((date) =>
      ensureDateOnOrAfterJoining({
        date,
        joiningDate: employee.joiningDate,
        action: "Attendance request date",
      }),
    );
    await Promise.all(
      normalizedDates.map((date) =>
        assertAttendanceRequestNotLocked(currentUser.id, date),
      ),
    );

    const pendingRequests =
      await AttendanceRequestRepository.findPendingRequestsByDates(
        currentUser.id,
        normalizedDates,
      );

    if (pendingRequests.length > 0) {
      const dates = pendingRequests
        .map((item) => item.attendanceDate.toISOString().slice(0, 10))
        .join(", ");

      throw new Error(
        `Pending attendance request already exists for: ${dates}`,
      );
    }

    const existingAttendances =
      await AttendanceRequestRepository.findAttendancesByDates(
        currentUser.id,
        normalizedDates,
      );
    const existingAttendanceMap = new Map(
      existingAttendances.map((attendance) => [
        attendanceKey(attendance.employeeId, attendance.date),
        attendance,
      ]),
    );
    const records = [];

    for (const item of data.requests) {
      const attendanceDate = normalizeDate(item.attendanceDate);
      ensureSundayRequestIsOtOnly(attendanceDate, item);

      const existingAttendance = existingAttendanceMap.get(
        attendanceKey(currentUser.id, attendanceDate),
      );

      if (
        item.requestType === AttendanceRequestType.ADD &&
        existingAttendance
      ) {
        throw new Error(
          `Attendance already exists for ${item.attendanceDate}. Use EDIT request`,
        );
      }

      if (
        item.requestType === AttendanceRequestType.EDIT &&
        !existingAttendance
      ) {
        throw new Error(
          `Attendance does not exist for ${item.attendanceDate}. Use ADD request`,
        );
      }

      if (
        item.requestType === AttendanceRequestType.EDIT &&
        existingAttendance?.status === item.requestedStatus &&
        !hasRequestedOtChange(item)
      ) {
        throw new Error(
          `Requested status is same as current attendance status for ${item.attendanceDate}`,
        );
      }

      records.push({
        employeeId: currentUser.id,
        attendanceDate,
        oldStatus: existingAttendance?.status ?? null,
        requestedStatus: item.requestedStatus,
        requestType: item.requestType,
        reason: item.reason,
        requestedById: currentUser.id,
        requestedCheckInTime: parseOptionalDateTime(item.requestedCheckInTime),
        requestedCheckOutTime: parseOptionalDateTime(item.requestedCheckOutTime),
        requestedOtStartTime: parseOptionalDateTime(item.requestedOtStartTime),
        requestedOtEndTime: parseOptionalDateTime(item.requestedOtEndTime),
        requestedOtHours: item.requestedOtHours ?? null,
        requestedOtManualOverride: item.requestedOtManualOverride ?? false,
        requestedOtOverrideReason: item.requestedOtOverrideReason ?? null,
      });
    }

    const result = await AttendanceRequestRepository.createMany(records);

    invalidateAttendanceCaches();

    return result;
  }

  static async myRequests(
    employeeId: string,
    query: {
      from?: string;
      to?: string;
      page?: string | number;
      limit?: string | number;
    },
  ) {
    const { page, limit, skip, take } = getPagination(query);
    const from = parseOptionalDate(query.from);
    const to = parseOptionalDate(query.to);

    if ((from && !to) || (!from && to)) {
      throw new Error("Both from and to dates are required");
    }

    if (from && to && from > to) {
      throw new Error("from date cannot be greater than to date");
    }

    const cacheKey = attendanceRequestReadCacheKey(
      "my",
      employeeId,
      query.from || "all",
      query.to || "all",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) return cached;

    const [statusRows, rangeStatusRows, rangeRequests] = await Promise.all([
      AttendanceRequestRepository.myRequestStatusCounts(employeeId),
      AttendanceRequestRepository.myRequestRangeStatusCounts(
        employeeId,
        from,
        to,
      ),
      AttendanceRequestRepository.myRequestsWithFilter(
        employeeId,
        from,
        to,
        { skip, take },
      ),
    ]);

    const total = rangeStatusRows.reduce(
      (sum, item) => sum + Number(item._count ?? 0),
      0,
    );
    const rangeGrouped = groupByStatus(rangeRequests);

    const result = {
      data: {
        overallCount: {
          total: statusRows.reduce(
            (sum, item) => sum + Number(item._count ?? 0),
            0,
          ),
          pending: countGroupedStatus(statusRows, RequestStatus.PENDING),
          approved: countGroupedStatus(statusRows, RequestStatus.APPROVED),
          rejected: countGroupedStatus(statusRows, RequestStatus.REJECTED),
        },
        rangeCount: {
          total,
          pending: countGroupedStatus(rangeStatusRows, RequestStatus.PENDING),
          approved: countGroupedStatus(rangeStatusRows, RequestStatus.APPROVED),
          rejected: countGroupedStatus(rangeStatusRows, RequestStatus.REJECTED),
        },
        pending: rangeGrouped.pending,
        approved: rangeGrouped.approved,
        rejected: rangeGrouped.rejected,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, 30);

    return result;
  }

  static async pendingRequests(query: {
    employeeId?: string;
    from?: string;
    to?: string;
    page?: string | number;
    limit?: string | number;
  }, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });
    const from = parseOptionalDate(query.from);
    const to = parseOptionalDate(query.to);

    if ((from && !to) || (!from && to)) {
      throw new Error("Both from and to dates are required");
    }

    if (from && to && from > to) {
      throw new Error("from date cannot be greater than to date");
    }

    const filters: {
      employeeWhere?: Prisma.EmployeeWhereInput;
      employeeId?: string;
      from?: Date;
      to?: Date;
    } = {
      employeeWhere,
    };

    if (authUser.role === Role.USER) {
      filters.employeeId = authUser.id;
      delete filters.employeeWhere;
    } else if (
      authUser.role === Role.SUPER_ADMIN &&
      query.employeeId &&
      query.employeeId !== "all"
    ) {
      filters.employeeId = query.employeeId;
      delete filters.employeeWhere;
    }

    if (from && to) {
      filters.from = from;
      filters.to = to;
    }

    const cacheKey = attendanceRequestReadCacheKey(
      "pending",
      authUser.role,
      authUser.id,
      query.employeeId || "scope",
      query.from || "all",
      query.to || "all",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) return cached;

    const [overallPendingCount, rangeRequests, total] = await Promise.all([
      AttendanceRequestRepository.pendingRequestsAll(filters),
      AttendanceRequestRepository.pendingRequestsWithFilter(filters, {
        skip,
        take,
      }),
      AttendanceRequestRepository.countPendingRequestsWithFilter(filters),
    ]);

    const statusCounts = countRequestedStatus(rangeRequests);

    const result = {
      data: {
        overallPendingCount,
        employeePendingCount: query.employeeId ? overallPendingCount : 0,
        employeeRangePendingCount: total,
        requestedStatusCounts: statusCounts,
        requests: rangeRequests,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, 30);

    return result;
  }

  static async decisionRequests(
    data: {
      requestIds: string[];
      action: "APPROVE" | "REJECT";
      rejectionReason?: string;
    },
    approvedById: string,
  ) {
    const uniqueIds = [...new Set(data.requestIds)];

    if (uniqueIds.length !== data.requestIds.length) {
      throw new Error("Duplicate requestIds are not allowed");
    }

    const requests = await AttendanceRequestRepository.findManyByIds(uniqueIds);

    if (requests.length !== uniqueIds.length) {
      throw new Error("One or more attendance requests not found");
    }

    const nonPending = requests.filter((item) => item.status !== "PENDING");

    if (nonPending.length > 0) {
      throw new Error("Only pending requests can be approved or rejected");
    }

    const inactiveEmployees = requests.filter(
      (item) => item.employee.status !== "ACTIVE",
    );

    if (inactiveEmployees.length > 0) {
      throw new Error("Cannot process requests for inactive employees");
    }

    if (data.action === "REJECT") {
      if (!data.rejectionReason || data.rejectionReason.trim().length < 5) {
        throw new Error("rejectionReason is required");
      }

      const result = await AttendanceRequestRepository.rejectMany({
        requestIds: uniqueIds,
        approvedById,
        rejectionReason: data.rejectionReason,
      });

      invalidateAttendanceCaches();

      return result;
    }

    const attendanceDates = requests.map((request) => request.attendanceDate);
    const minDate = new Date(
      Math.min(...attendanceDates.map((date) => date.getTime())),
    );
    const maxDate = new Date(
      Math.max(...attendanceDates.map((date) => date.getTime())),
    );
    const [currentAttendances, activePayrolls] = await Promise.all([
      AttendanceRepository.findByEmployeeAndDates(
        requests.map((request) => ({
          employeeId: request.employeeId,
          date: request.attendanceDate,
        })),
      ),
      AttendanceRepository.findActivePayrollLocks({
        employeeIds: [...new Set(requests.map((request) => request.employeeId))],
        minDate,
        maxDate,
      }),
    ]);
    const currentAttendanceMap = new Map(
      currentAttendances.map((attendance) => [
        attendanceKey(attendance.employeeId, attendance.date),
        attendance,
      ]),
    );

    for (const request of requests) {
      const hasLockedPayroll = activePayrolls.some(
        (payroll) =>
          payroll.employeeId === request.employeeId &&
          isAttendanceDateLockedByPayroll(payroll, request.attendanceDate),
      );

      if (hasLockedPayroll) {
        throw new Error(
          "Cannot approve attendance request because payroll already exists for this attendance period. Cancel or recalculate payroll first.",
        );
      }

      const currentAttendance = currentAttendanceMap.get(
        attendanceKey(request.employeeId, request.attendanceDate),
      );

      if (request.requestType === "ADD" && currentAttendance) {
        throw new Error(
          `Cannot approve ADD request because attendance already exists for ${request.attendanceDate.toISOString().slice(0, 10)}`,
        );
      }

      if (request.requestType === "EDIT" && !currentAttendance) {
        throw new Error(
          `Cannot approve EDIT request because attendance does not exist for ${request.attendanceDate.toISOString().slice(0, 10)}`,
        );
      }

      if (
        request.requestType === "EDIT" &&
        currentAttendance?.status === request.requestedStatus &&
        !requestHasOtChange(request)
      ) {
        throw new Error(
          `Cannot approve because requested status is already applied for ${request.attendanceDate.toISOString().slice(0, 10)}`,
        );
      }
    }

    const result = await AttendanceRequestRepository.approveMany({
      requests,
      approvedById,
    });

    invalidateAttendanceCaches();

    return result;
  }

  static async approveRequest(requestId: string, approvedById: string) {
    const request = await AttendanceRequestRepository.findById(requestId);

    if (!request) {
      throw new Error("Attendance request not found");
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Only pending request can be approved");
    }

    if (request.employee.status !== "ACTIVE") {
      throw new Error("Cannot approve request for inactive employee");
    }

    await assertAttendanceApprovalNotLocked(
      request.employeeId,
      request.attendanceDate,
    );

    const currentAttendance = await AttendanceRequestRepository.findAttendance(
      request.employeeId,
      request.attendanceDate,
    );

    if (
      request.requestType === AttendanceRequestType.ADD &&
      currentAttendance
    ) {
      throw new Error(
        "Cannot approve ADD request because attendance already exists",
      );
    }

    if (
      request.requestType === AttendanceRequestType.EDIT &&
      !currentAttendance
    ) {
      throw new Error(
        "Cannot approve EDIT request because attendance does not exist",
      );
    }

    if (
      request.requestType === AttendanceRequestType.EDIT &&
      currentAttendance?.status === request.requestedStatus &&
      !requestHasOtChange(request)
    ) {
      throw new Error(
        "Cannot approve because requested status is already applied",
      );
    }

    const result = await AttendanceRequestRepository.approveRequest({
      requestId,
      approvedById,
      employeeId: request.employeeId,
      attendanceDate: request.attendanceDate,
      requestedStatus: request.requestedStatus,
      requestedCheckInTime: request.requestedCheckInTime,
      requestedCheckOutTime: request.requestedCheckOutTime,
      requestedOtStartTime: request.requestedOtStartTime,
      requestedOtEndTime: request.requestedOtEndTime,
      requestedOtHours:
        request.requestedOtHours === null
          ? null
          : Number(request.requestedOtHours ?? 0),
      requestedOtManualOverride: request.requestedOtManualOverride,
      requestedOtOverrideReason: request.requestedOtOverrideReason,
    });

    invalidateAttendanceCaches();

    return result;
  }

  static async rejectRequest(
    requestId: string,
    approvedById: string,
    rejectionReason: string,
  ) {
    const request = await AttendanceRequestRepository.findById(requestId);

    if (!request) {
      throw new Error("Attendance request not found");
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Only pending request can be rejected");
    }

    const result = await AttendanceRequestRepository.rejectRequest({
      requestId,
      approvedById,
      rejectionReason,
    });

    invalidateAttendanceCaches();

    return result;
  }

  static async deleteOwnRequest(
    requestId: string,
    currentUser: {
      id: string;
      role: Role;
    },
  ) {
    if (currentUser.role !== Role.USER) {
      throw new Error("Only USER can delete own attendance request");
    }

    const request = await AttendanceRequestRepository.findById(requestId);

    if (!request) {
      throw new Error("Attendance request not found");
    }

    if (request.employeeId !== currentUser.id) {
      throw new Error("You can delete only your own attendance request");
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new Error("Only pending request can be deleted");
    }

    const deletedRequest =
      await AttendanceRequestRepository.deleteOwnPendingRequest(requestId);

    invalidateAttendanceCaches();

    return deletedRequest;
  }
}
