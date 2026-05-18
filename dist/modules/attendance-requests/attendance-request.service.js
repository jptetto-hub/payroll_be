"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRequestService = void 0;
const client_1 = require("@prisma/client");
const attendance_request_repository_1 = require("./attendance-request.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const normalizeDate = (date) => {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const formatDate = (date) => date.toISOString().slice(0, 10);
const ensureDateOnOrAfterJoining = (params) => {
    if (formatDate(params.date) < formatDate(params.joiningDate)) {
        throw new Error(`${params.action} cannot be before employee joining date ${formatDate(params.joiningDate)}`);
    }
};
const ensureNotFutureDate = (date) => {
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (date > todayUtc) {
        throw new Error("Future attendance request is not allowed");
    }
};
const parseOptionalDate = (value) => {
    if (!value)
        return undefined;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
    }
    return parsed;
};
const parseOptionalDateTime = (value) => {
    if (!value)
        return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Invalid date-time value");
    }
    return parsed;
};
const hasRequestedOtChange = (item) => Boolean(item.requestedCheckInTime ||
    item.requestedCheckOutTime ||
    item.requestedOtStartTime ||
    item.requestedOtEndTime ||
    item.requestedOtHours !== undefined ||
    item.requestedOtManualOverride !== undefined);
const requestHasOtChange = (request) => Boolean(request.requestedCheckInTime ||
    request.requestedCheckOutTime ||
    request.requestedOtStartTime ||
    request.requestedOtEndTime ||
    request.requestedOtHours !== null ||
    request.requestedOtManualOverride);
const groupByStatus = (requests) => {
    return {
        pending: requests.filter((item) => item.status === "PENDING"),
        approved: requests.filter((item) => item.status === "APPROVED"),
        rejected: requests.filter((item) => item.status === "REJECTED"),
    };
};
const countRequestedStatus = (requests) => {
    return {
        present: requests.filter((item) => item.requestedStatus === "PRESENT")
            .length,
        absent: requests.filter((item) => item.requestedStatus === "ABSENT").length,
        halfDay: requests.filter((item) => item.requestedStatus === "HALF_DAY")
            .length,
    };
};
class AttendanceRequestService {
    static async createRequest(data, currentUser) {
        if (currentUser.role !== client_1.Role.USER) {
            throw new Error("Only USER can create attendance request");
        }
        const employee = await attendance_request_repository_1.AttendanceRequestRepository.findEmployee(currentUser.id);
        if (!employee) {
            throw new Error("Employee not found");
        }
        if (employee.status !== "ACTIVE") {
            throw new Error("Inactive employee cannot create attendance request");
        }
        const seenDates = new Set();
        for (const item of data.requests) {
            if (seenDates.has(item.attendanceDate)) {
                throw new Error(`Duplicate attendance date found: ${item.attendanceDate}`);
            }
            seenDates.add(item.attendanceDate);
        }
        const normalizedDates = data.requests.map((item) => normalizeDate(item.attendanceDate));
        normalizedDates.forEach(ensureNotFutureDate);
        normalizedDates.forEach((date) => ensureDateOnOrAfterJoining({
            date,
            joiningDate: employee.joiningDate,
            action: "Attendance request date",
        }));
        const pendingRequests = await attendance_request_repository_1.AttendanceRequestRepository.findPendingRequestsByDates(currentUser.id, normalizedDates);
        if (pendingRequests.length > 0) {
            const dates = pendingRequests
                .map((item) => item.attendanceDate.toISOString().slice(0, 10))
                .join(", ");
            throw new Error(`Pending attendance request already exists for: ${dates}`);
        }
        const records = [];
        for (const item of data.requests) {
            const attendanceDate = normalizeDate(item.attendanceDate);
            const existingAttendance = await attendance_request_repository_1.AttendanceRequestRepository.findAttendance(currentUser.id, attendanceDate);
            if (item.requestType === client_1.AttendanceRequestType.ADD &&
                existingAttendance) {
                throw new Error(`Attendance already exists for ${item.attendanceDate}. Use EDIT request`);
            }
            if (item.requestType === client_1.AttendanceRequestType.EDIT &&
                !existingAttendance) {
                throw new Error(`Attendance does not exist for ${item.attendanceDate}. Use ADD request`);
            }
            if (item.requestType === client_1.AttendanceRequestType.EDIT &&
                existingAttendance?.status === item.requestedStatus &&
                !hasRequestedOtChange(item)) {
                throw new Error(`Requested status is same as current attendance status for ${item.attendanceDate}`);
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
        return attendance_request_repository_1.AttendanceRequestRepository.createMany(records);
    }
    static async myRequests(employeeId, query) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const from = parseOptionalDate(query.from);
        const to = parseOptionalDate(query.to);
        if ((from && !to) || (!from && to)) {
            throw new Error("Both from and to dates are required");
        }
        if (from && to && from > to) {
            throw new Error("from date cannot be greater than to date");
        }
        const allRequests = await attendance_request_repository_1.AttendanceRequestRepository.myRequestsAll(employeeId);
        const [rangeRequests, total] = await Promise.all([
            attendance_request_repository_1.AttendanceRequestRepository.myRequestsWithFilter(employeeId, from, to, { skip, take }),
            attendance_request_repository_1.AttendanceRequestRepository.countMyRequestsWithFilter(employeeId, from, to),
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
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async pendingRequests(query, authUser) {
        const { page, limit, skip, take } = (0, pagination_util_1.getPagination)(query);
        const { employeeWhere } = (0, employee_scope_util_1.resolveEmployeeScope)({
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
        const filters = {
            employeeWhere,
        };
        if (from && to) {
            filters.from = from;
            filters.to = to;
        }
        const overallPending = await attendance_request_repository_1.AttendanceRequestRepository.pendingRequestsAll(employeeWhere);
        const [rangeRequests, total] = await Promise.all([
            attendance_request_repository_1.AttendanceRequestRepository.pendingRequestsWithFilter(filters, {
                skip,
                take,
            }),
            attendance_request_repository_1.AttendanceRequestRepository.countPendingRequestsWithFilter(filters),
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
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
    }
    static async decisionRequests(data, approvedById) {
        const uniqueIds = [...new Set(data.requestIds)];
        if (uniqueIds.length !== data.requestIds.length) {
            throw new Error("Duplicate requestIds are not allowed");
        }
        const requests = await attendance_request_repository_1.AttendanceRequestRepository.findManyByIds(uniqueIds);
        if (requests.length !== uniqueIds.length) {
            throw new Error("One or more attendance requests not found");
        }
        const nonPending = requests.filter((item) => item.status !== "PENDING");
        if (nonPending.length > 0) {
            throw new Error("Only pending requests can be approved or rejected");
        }
        const inactiveEmployees = requests.filter((item) => item.employee.status !== "ACTIVE");
        if (inactiveEmployees.length > 0) {
            throw new Error("Cannot process requests for inactive employees");
        }
        if (data.action === "REJECT") {
            if (!data.rejectionReason || data.rejectionReason.trim().length < 5) {
                throw new Error("rejectionReason is required");
            }
            return attendance_request_repository_1.AttendanceRequestRepository.rejectMany({
                requestIds: uniqueIds,
                approvedById,
                rejectionReason: data.rejectionReason,
            });
        }
        for (const request of requests) {
            await (0, payroll_lock_util_1.assertAttendanceApprovalNotLocked)(request.employeeId, request.attendanceDate);
            const currentAttendance = await attendance_request_repository_1.AttendanceRequestRepository.findAttendance(request.employeeId, request.attendanceDate);
            if (request.requestType === "ADD" && currentAttendance) {
                throw new Error(`Cannot approve ADD request because attendance already exists for ${request.attendanceDate.toISOString().slice(0, 10)}`);
            }
            if (request.requestType === "EDIT" && !currentAttendance) {
                throw new Error(`Cannot approve EDIT request because attendance does not exist for ${request.attendanceDate.toISOString().slice(0, 10)}`);
            }
            if (request.requestType === "EDIT" &&
                currentAttendance?.status === request.requestedStatus &&
                !requestHasOtChange(request)) {
                throw new Error(`Cannot approve because requested status is already applied for ${request.attendanceDate.toISOString().slice(0, 10)}`);
            }
        }
        return attendance_request_repository_1.AttendanceRequestRepository.approveMany({
            requestIds: uniqueIds,
            approvedById,
        });
    }
    static async approveRequest(requestId, approvedById) {
        const request = await attendance_request_repository_1.AttendanceRequestRepository.findById(requestId);
        if (!request) {
            throw new Error("Attendance request not found");
        }
        if (request.status !== client_1.RequestStatus.PENDING) {
            throw new Error("Only pending request can be approved");
        }
        if (request.employee.status !== "ACTIVE") {
            throw new Error("Cannot approve request for inactive employee");
        }
        await (0, payroll_lock_util_1.assertAttendanceApprovalNotLocked)(request.employeeId, request.attendanceDate);
        const currentAttendance = await attendance_request_repository_1.AttendanceRequestRepository.findAttendance(request.employeeId, request.attendanceDate);
        if (request.requestType === client_1.AttendanceRequestType.ADD &&
            currentAttendance) {
            throw new Error("Cannot approve ADD request because attendance already exists");
        }
        if (request.requestType === client_1.AttendanceRequestType.EDIT &&
            !currentAttendance) {
            throw new Error("Cannot approve EDIT request because attendance does not exist");
        }
        if (request.requestType === client_1.AttendanceRequestType.EDIT &&
            currentAttendance?.status === request.requestedStatus &&
            !requestHasOtChange(request)) {
            throw new Error("Cannot approve because requested status is already applied");
        }
        return attendance_request_repository_1.AttendanceRequestRepository.approveRequest({
            requestId,
            approvedById,
            employeeId: request.employeeId,
            attendanceDate: request.attendanceDate,
            requestedStatus: request.requestedStatus,
            requestedCheckInTime: request.requestedCheckInTime,
            requestedCheckOutTime: request.requestedCheckOutTime,
            requestedOtStartTime: request.requestedOtStartTime,
            requestedOtEndTime: request.requestedOtEndTime,
            requestedOtHours: request.requestedOtHours === null
                ? null
                : Number(request.requestedOtHours ?? 0),
            requestedOtManualOverride: request.requestedOtManualOverride,
            requestedOtOverrideReason: request.requestedOtOverrideReason,
        });
    }
    static async rejectRequest(requestId, approvedById, rejectionReason) {
        const request = await attendance_request_repository_1.AttendanceRequestRepository.findById(requestId);
        if (!request) {
            throw new Error("Attendance request not found");
        }
        if (request.status !== client_1.RequestStatus.PENDING) {
            throw new Error("Only pending request can be rejected");
        }
        return attendance_request_repository_1.AttendanceRequestRepository.rejectRequest({
            requestId,
            approvedById,
            rejectionReason,
        });
    }
    static async deleteOwnRequest(requestId, currentUser) {
        if (currentUser.role !== client_1.Role.USER) {
            throw new Error("Only USER can delete own attendance request");
        }
        const request = await attendance_request_repository_1.AttendanceRequestRepository.findById(requestId);
        if (!request) {
            throw new Error("Attendance request not found");
        }
        if (request.employeeId !== currentUser.id) {
            throw new Error("You can delete only your own attendance request");
        }
        if (request.status !== client_1.RequestStatus.PENDING) {
            throw new Error("Only pending request can be deleted");
        }
        return attendance_request_repository_1.AttendanceRequestRepository.deleteOwnPendingRequest(requestId);
    }
}
exports.AttendanceRequestService = AttendanceRequestService;
//# sourceMappingURL=attendance-request.service.js.map