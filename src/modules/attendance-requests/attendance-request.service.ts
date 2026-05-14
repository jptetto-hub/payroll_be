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
import { assertAttendanceApprovalNotLocked } from "../../shared/payroll/payroll-lock.util";

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
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );

  if (date > todayUtc) {
    throw new Error("Future attendance request is not allowed");
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

export class AttendanceRequestService {
  static async createRequest(
    data: {
      requests: {
        attendanceDate: string;
        requestedStatus: AttendanceStatus;
        requestType: AttendanceRequestType;
        reason: string;
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

    const records = [];

    for (const item of data.requests) {
      const attendanceDate = normalizeDate(item.attendanceDate);

      const existingAttendance =
        await AttendanceRequestRepository.findAttendance(
          currentUser.id,
          attendanceDate,
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
        existingAttendance?.status === item.requestedStatus
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
      });
    }

    return AttendanceRequestRepository.createMany(records);
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

    const allRequests =
      await AttendanceRequestRepository.myRequestsAll(employeeId);

    const [rangeRequests, total] = await Promise.all([
      AttendanceRequestRepository.myRequestsWithFilter(
        employeeId,
        from,
        to,
        { skip, take },
      ),
      AttendanceRequestRepository.countMyRequestsWithFilter(
        employeeId,
        from,
        to,
      ),
    ]);

    const allGrouped = groupByStatus(allRequests);
    const rangeGrouped = groupByStatus(rangeRequests);

    return {
      data: {
        overallCount: {
          total: allRequests.length,
          pending: allGrouped.pending.length,
          approved: allGrouped.approved.length,
          rejected: allGrouped.rejected.length,
        },
        rangeCount: {
          total,
          pending: rangeGrouped.pending.length,
          approved: rangeGrouped.approved.length,
          rejected: rangeGrouped.rejected.length,
        },
        pending: rangeGrouped.pending,
        approved: rangeGrouped.approved,
        rejected: rangeGrouped.rejected,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };
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
      from?: Date;
      to?: Date;
    } = {
      employeeWhere,
    };

    if (from && to) {
      filters.from = from;
      filters.to = to;
    }

    const overallPending =
      await AttendanceRequestRepository.pendingRequestsAll(employeeWhere);

    const [rangeRequests, total] = await Promise.all([
      AttendanceRequestRepository.pendingRequestsWithFilter(filters, {
        skip,
        take,
      }),
      AttendanceRequestRepository.countPendingRequestsWithFilter(filters),
    ]);

    const statusCounts = countRequestedStatus(rangeRequests);

    return {
      data: {
        overallPendingCount: overallPending.length,
        employeePendingCount: query.employeeId ? overallPending.length : 0,
        employeeRangePendingCount: total,
        requestedStatusCounts: statusCounts,
        requests: rangeRequests,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };
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

      return AttendanceRequestRepository.rejectMany({
        requestIds: uniqueIds,
        approvedById,
        rejectionReason: data.rejectionReason,
      });
    }

    for (const request of requests) {
      await assertAttendanceApprovalNotLocked(
        request.employeeId,
        request.attendanceDate,
      );

      const currentAttendance =
        await AttendanceRequestRepository.findAttendance(
          request.employeeId,
          request.attendanceDate,
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
        currentAttendance?.status === request.requestedStatus
      ) {
        throw new Error(
          `Cannot approve because requested status is already applied for ${request.attendanceDate.toISOString().slice(0, 10)}`,
        );
      }
    }

    return AttendanceRequestRepository.approveMany({
      requestIds: uniqueIds,
      approvedById,
    });
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
      currentAttendance?.status === request.requestedStatus
    ) {
      throw new Error(
        "Cannot approve because requested status is already applied",
      );
    }

    return AttendanceRequestRepository.approveRequest({
      requestId,
      approvedById,
      employeeId: request.employeeId,
      attendanceDate: request.attendanceDate,
      requestedStatus: request.requestedStatus,
    });
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

    return AttendanceRequestRepository.rejectRequest({
      requestId,
      approvedById,
      rejectionReason,
    });
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

    return AttendanceRequestRepository.deleteOwnPendingRequest(requestId);
  }
}
