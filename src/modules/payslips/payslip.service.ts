import { PayrollStatus, Role } from "@prisma/client";
import { PayslipRepository } from "./payslip.repository";
import { payslipQueue } from "../../jobs/payslip.queue";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { PerformanceTimer } from "../../utils/performanceTimer";
import { CacheService } from "../../utils/cache";

const PAYSLIP_READ_CACHE_PREFIX = "payslip-read";
const PAYSLIP_READ_CACHE_TTL = 30;

const parseDateOnly = (value: string) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date format. Use YYYY-MM-DD");
  }

  return parsed;
};

const parseOptionalDateOnly = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  return parseDateOnly(value);
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const parseDateRange = (query: any) => {
  const from = parseOptionalDateOnly(query.from);
  const to = parseOptionalDateOnly(query.to);

  if (from && to && from > to) {
    throw new Error("From date cannot be greater than To date");
  }

  return { from, to };
};

const invalidatePayslipReadCaches = () => {
  void Promise.all([
    CacheService.delByPattern(`${PAYSLIP_READ_CACHE_PREFIX}:*`),
    CacheService.delByPattern("payroll-read:*"),
    CacheService.delByPattern("dashboard:*"),
    CacheService.delByPattern("dashboard-summary:*"),
  ]);
};

const ensureEmployeeAccess = (targetRole: Role, currentRole: Role) => {
  if (currentRole === Role.ADMIN && targetRole !== Role.USER) {
    throw new Error("ADMIN can access payslips only for USER employees");
  }
};

export class PayslipService {
  static async createFromPayroll(payrollId: string) {
    const timer = new PerformanceTimer("PayslipService.createFromPayroll");
    timer.checkpoint("start");

    const payroll = await PayslipRepository.findPayroll(payrollId);
    timer.checkpoint("payroll fetch");

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    if (payroll.status === PayrollStatus.CANCELLED) {
      throw new Error("Cannot create payslip for cancelled payroll");
    }

    if (payroll.status === PayrollStatus.SUPERSEDED) {
      throw new Error("Cannot create payslip for superseded payroll");
    }

    const payslip = await PayslipRepository.createFromPayroll(payroll);
    timer.checkpoint("payslip upsert");
    invalidatePayslipReadCaches();
    timer.end();

    return payslip;
  }

  static async retryGeneration(id: string) {
    const payslip = await PayslipRepository.findRetryTarget(id);

    if (!payslip) {
      throw new Error("Payslip not found");
    }

    await PayslipRepository.markRetryQueued(payslip.id);

    await payslipQueue.add(
      "generate-payslip",
      {
        payrollId: payslip.payrollId,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    );
    invalidatePayslipReadCaches();

    return payslip;
  }

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const { directEmployeeId, employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });
    const cacheKey = CacheService.buildKey(
      PAYSLIP_READ_CACHE_PREFIX,
      "list",
      authUser.role,
      authUser.id,
      query.employeeId ?? "all",
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [payslips, total] = await PayslipRepository.listAll({
      skip,
      take,
      ...(directEmployeeId && { employeeId: directEmployeeId }),
      employeeWhere,
      ...dateRange,
    });

    const result = {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);

    return result;
  }

  static async myPayslips(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const cacheKey = CacheService.buildKey(
      PAYSLIP_READ_CACHE_PREFIX,
      "my",
      employeeId,
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [payslips, total] = await Promise.all([
      PayslipRepository.listByEmployee(employeeId, { skip, take }, dateRange),
      PayslipRepository.countByEmployeeWithFilters(employeeId, dateRange),
    ]);

    const result = {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);

    return result;
  }

  static async getById(id: string, currentUser: { id: string; role: Role }) {
    const payslip = await PayslipRepository.findById(id);

    if (!payslip) {
      throw new Error("Payslip not found");
    }

    if (
      currentUser.role === Role.USER &&
      payslip.employeeId !== currentUser.id
    ) {
      throw new Error("You can view only your own payslip");
    }

    ensureEmployeeAccess(payslip.employee.role, currentUser.role);

    return payslip;
  }

  static async getByPayroll(payrollId: string, currentRole: Role) {
    const payroll = await PayslipRepository.findPayroll(payrollId);

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    ensureEmployeeAccess(payroll.employee.role, currentRole);

    const payslip = await PayslipRepository.findByPayroll(payrollId);

    if (!payslip) {
      throw new Error("Payslip not found for this payroll");
    }

    return payslip;
  }

  static async listByEmployee(
    employeeId: string,
    currentRole: Role,
    query: any,
  ) {
    const employee = await PayslipRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    ensureEmployeeAccess(employee.role, currentRole);

    const { page, limit, skip, take } = getPagination(query);
    const dateRange = parseDateRange(query);
    const cacheKey = CacheService.buildKey(
      PAYSLIP_READ_CACHE_PREFIX,
      "employee",
      employeeId,
      dateRange.from ? formatDate(dateRange.from) : "any-from",
      dateRange.to ? formatDate(dateRange.to) : "any-to",
      page,
      limit,
    );
    const cached = await CacheService.get<any>(cacheKey);

    if (cached) {
      return cached;
    }

    const [payslips, total] = await Promise.all([
      PayslipRepository.listByEmployee(employeeId, { skip, take }, dateRange),
      PayslipRepository.countByEmployeeWithFilters(employeeId, dateRange),
    ]);

    const result = {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };

    void CacheService.set(cacheKey, result, PAYSLIP_READ_CACHE_TTL);

    return result;
  }
}
