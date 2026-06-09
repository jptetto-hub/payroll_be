"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttendanceRequestService = void 0;
const client_1 = require("@prisma/client");
const attendance_request_repository_1 = require("./attendance-request.repository");
const pagination_util_1 = require("../../shared/utils/pagination.util");
const employee_scope_util_1 = require("../../shared/utils/employee-scope.util");
const payroll_lock_util_1 = require("../../shared/payroll/payroll-lock.util");
const cache_1 = require("../../utils/cache");
const attendance_repository_1 = require("../attendance/attendance.repository");
const business_date_util_1 = require("../../shared/time/business-date.util");
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
    if (date > (0, business_date_util_1.getBusinessDate)()) {
        throw new Error("Future attendance request is not allowed");
    }
};
const isSunday = (date) => date.getUTCDay() === 0;
const ensureSundayRequestIsOtOnly = (attendanceDate, item) => {
    if (!isSunday(attendanceDate)) {
        return;
    }
    const hasOt = Number(item.requestedOtHours ?? 0) > 0 ||
        Boolean((item.requestedOtStartTime || item.requestedCheckInTime) &&
            (item.requestedOtEndTime || item.requestedCheckOutTime));
    if (!hasOt) {
        throw new Error("Sunday attendance is skipped. Submit OT start/end or OT hours only for Sunday.");
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
const countGroupedStatus = (requests, status) => Number(requests.find((item) => item.status === status)?._count ?? 0);
const attendanceKey = (employeeId, date) => `${employeeId}_${formatDate(date)}`;
const invalidateAttendanceCaches = () => {
    void Promise.all([
        cache_1.CacheService.delByPattern("attendance-read:*"),
        cache_1.CacheService.delByPattern("attendance-requests-read:*"),
        cache_1.CacheService.delByPattern("dashboard:*"),
        cache_1.CacheService.delByPattern("dashboard-summary:*"),
        cache_1.CacheService.delByPattern("attendance-summary:*"),
    ]);
};
const attendanceRequestReadCacheKey = (section, ...parts) => cache_1.CacheService.buildKey("attendance-requests-read", section, ...parts);
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
        await Promise.all(normalizedDates.map((date) => (0, payroll_lock_util_1.assertAttendanceRequestNotLocked)(currentUser.id, date)));
        const pendingRequests = await attendance_request_repository_1.AttendanceRequestRepository.findPendingRequestsByDates(currentUser.id, normalizedDates);
        if (pendingRequests.length > 0) {
            const dates = pendingRequests
                .map((item) => item.attendanceDate.toISOString().slice(0, 10))
                .join(", ");
            throw new Error(`Pending attendance request already exists for: ${dates}`);
        }
        const existingAttendances = await attendance_request_repository_1.AttendanceRequestRepository.findAttendancesByDates(currentUser.id, normalizedDates);
        const existingAttendanceMap = new Map(existingAttendances.map((attendance) => [
            attendanceKey(attendance.employeeId, attendance.date),
            attendance,
        ]));
        const records = [];
        for (const item of data.requests) {
            const attendanceDate = normalizeDate(item.attendanceDate);
            ensureSundayRequestIsOtOnly(attendanceDate, item);
            const existingAttendance = existingAttendanceMap.get(attendanceKey(currentUser.id, attendanceDate));
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
        const result = await attendance_request_repository_1.AttendanceRequestRepository.createMany(records);
        invalidateAttendanceCaches();
        return result;
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
        const cacheKey = attendanceRequestReadCacheKey("my", employeeId, query.from || "all", query.to || "all", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const [statusRows, rangeStatusRows, rangeRequests] = await Promise.all([
            attendance_request_repository_1.AttendanceRequestRepository.myRequestStatusCounts(employeeId),
            attendance_request_repository_1.AttendanceRequestRepository.myRequestRangeStatusCounts(employeeId, from, to),
            attendance_request_repository_1.AttendanceRequestRepository.myRequestsWithFilter(employeeId, from, to, { skip, take }),
        ]);
        const total = rangeStatusRows.reduce((sum, item) => sum + Number(item._count ?? 0), 0);
        const rangeGrouped = groupByStatus(rangeRequests);
        const result = {
            data: {
                overallCount: {
                    total: statusRows.reduce((sum, item) => sum + Number(item._count ?? 0), 0),
                    pending: countGroupedStatus(statusRows, client_1.RequestStatus.PENDING),
                    approved: countGroupedStatus(statusRows, client_1.RequestStatus.APPROVED),
                    rejected: countGroupedStatus(statusRows, client_1.RequestStatus.REJECTED),
                },
                rangeCount: {
                    total,
                    pending: countGroupedStatus(rangeStatusRows, client_1.RequestStatus.PENDING),
                    approved: countGroupedStatus(rangeStatusRows, client_1.RequestStatus.APPROVED),
                    rejected: countGroupedStatus(rangeStatusRows, client_1.RequestStatus.REJECTED),
                },
                pending: rangeGrouped.pending,
                approved: rangeGrouped.approved,
                rejected: rangeGrouped.rejected,
            },
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, 30);
        return result;
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
        if (authUser.role === client_1.Role.USER) {
            filters.employeeId = authUser.id;
            delete filters.employeeWhere;
        }
        else if (authUser.role === client_1.Role.SUPER_ADMIN &&
            query.employeeId &&
            query.employeeId !== "all") {
            filters.employeeId = query.employeeId;
            delete filters.employeeWhere;
        }
        if (from && to) {
            filters.from = from;
            filters.to = to;
        }
        const cacheKey = attendanceRequestReadCacheKey("pending", authUser.role, authUser.id, query.employeeId || "scope", query.from || "all", query.to || "all", page, limit);
        const cached = await cache_1.CacheService.get(cacheKey);
        if (cached)
            return cached;
        const [overallPendingCount, rangeRequests, total] = await Promise.all([
            attendance_request_repository_1.AttendanceRequestRepository.pendingRequestsAll(filters),
            attendance_request_repository_1.AttendanceRequestRepository.pendingRequestsWithFilter(filters, {
                skip,
                take,
            }),
            attendance_request_repository_1.AttendanceRequestRepository.countPendingRequestsWithFilter(filters),
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
            pagination: (0, pagination_util_1.buildPaginationMeta)(total, page, limit),
        };
        void cache_1.CacheService.set(cacheKey, result, 30);
        return result;
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
            const result = await attendance_request_repository_1.AttendanceRequestRepository.rejectMany({
                requestIds: uniqueIds,
                approvedById,
                rejectionReason: data.rejectionReason,
            });
            invalidateAttendanceCaches();
            return result;
        }
        const attendanceDates = requests.map((request) => request.attendanceDate);
        const minDate = new Date(Math.min(...attendanceDates.map((date) => date.getTime())));
        const maxDate = new Date(Math.max(...attendanceDates.map((date) => date.getTime())));
        const [currentAttendances, activePayrolls] = await Promise.all([
            attendance_repository_1.AttendanceRepository.findByEmployeeAndDates(requests.map((request) => ({
                employeeId: request.employeeId,
                date: request.attendanceDate,
            }))),
            attendance_repository_1.AttendanceRepository.findActivePayrollLocks({
                employeeIds: [...new Set(requests.map((request) => request.employeeId))],
                minDate,
                maxDate,
            }),
        ]);
        const currentAttendanceMap = new Map(currentAttendances.map((attendance) => [
            attendanceKey(attendance.employeeId, attendance.date),
            attendance,
        ]));
        for (const request of requests) {
            const hasLockedPayroll = activePayrolls.some((payroll) => payroll.employeeId === request.employeeId &&
                (0, payroll_lock_util_1.isAttendanceDateLockedByPayroll)(payroll, request.attendanceDate));
            if (hasLockedPayroll) {
                throw new Error("Cannot approve attendance request because payroll already exists for this attendance period. Cancel or recalculate payroll first.");
            }
            const currentAttendance = currentAttendanceMap.get(attendanceKey(request.employeeId, request.attendanceDate));
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
        const result = await attendance_request_repository_1.AttendanceRequestRepository.approveMany({
            requests,
            approvedById,
        });
        invalidateAttendanceCaches();
        return result;
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
        const result = await attendance_request_repository_1.AttendanceRequestRepository.approveRequest({
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
        invalidateAttendanceCaches();
        return result;
    }
    static async rejectRequest(requestId, approvedById, rejectionReason) {
        const request = await attendance_request_repository_1.AttendanceRequestRepository.findById(requestId);
        if (!request) {
            throw new Error("Attendance request not found");
        }
        if (request.status !== client_1.RequestStatus.PENDING) {
            throw new Error("Only pending request can be rejected");
        }
        const result = await attendance_request_repository_1.AttendanceRequestRepository.rejectRequest({
            requestId,
            approvedById,
            rejectionReason,
        });
        invalidateAttendanceCaches();
        return result;
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
        const deletedRequest = await attendance_request_repository_1.AttendanceRequestRepository.deleteOwnPendingRequest(requestId);
        invalidateAttendanceCaches();
        return deletedRequest;
    }
}
exports.AttendanceRequestService = AttendanceRequestService;
//# sourceMappingURL=attendance-request.service.js.map