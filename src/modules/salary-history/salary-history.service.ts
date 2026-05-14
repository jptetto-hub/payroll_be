import { Role } from "@prisma/client";
import { SalaryHistoryRepository } from "./salary-history.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { assertSalaryHistoryNotLocked } from "../../shared/payroll/payroll-lock.util";

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

export class SalaryHistoryService {
  private static ensureAllowedReadAccess(
    employeeId: string,
    currentUserRole: Role,
    currentUserId: string,
  ) {
    if (currentUserRole === Role.USER && employeeId !== currentUserId) {
      throw new Error("USER can view only own salary history");
    }
  }

  static async createSalaryHistory(data: {
    employeeId: string;
    salaryAmount: number;
    effectiveFrom: string;
  }) {
    const employee = await SalaryHistoryRepository.findEmployee(
      data.employeeId,
    );

    if (!employee) {
      throw new Error("Employee not found");
    }

    if (employee.status !== "ACTIVE") {
      throw new Error("Cannot add salary history for inactive employee");
    }

    const effectiveFrom = new Date(data.effectiveFrom);

    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new Error("Invalid effectiveFrom date format");
    }

    ensureDateOnOrAfterJoining({
      date: effectiveFrom,
      joiningDate: employee.joiningDate,
      action: "Salary history effective date",
    });

    await assertSalaryHistoryNotLocked({
      employeeId: data.employeeId,
      effectiveFrom,
    });

    const existingRecord =
      await SalaryHistoryRepository.findByEmployeeAndEffectiveDate(
        data.employeeId,
        effectiveFrom,
      );

    if (existingRecord) {
      throw new Error(
        "Salary history already exists for this employee on this effective date",
      );
    }

    return SalaryHistoryRepository.create({
      employeeId: data.employeeId,
      salaryAmount: data.salaryAmount,
      effectiveFrom,
    });
  }

  static async listSalaryHistory(
    employeeId: string,
    currentUserRole: Role,
    currentUserId: string,
    query: any,
  ) {
    this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);

    const employee = await SalaryHistoryRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const { page, limit, skip, take } = getPagination(query);
    const [histories, total] = await Promise.all([
      SalaryHistoryRepository.listByEmployee(employeeId, { skip, take }),
      SalaryHistoryRepository.countByEmployee(employeeId),
    ]);

    return {
      data: {
        employee,
        histories,
      },
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async getCurrentSalary(
    employeeId: string,
    currentUserRole: Role,
    currentUserId: string,
  ) {
    this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);

    const employee = await SalaryHistoryRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const salary = await SalaryHistoryRepository.getCurrentSalary(employeeId);

    return {
      employee,
      salary,
    };
  }

  static async resolveSalary(
    employeeId: string,
    date: string,
    currentUserRole: Role,
    currentUserId: string,
  ) {
    this.ensureAllowedReadAccess(employeeId, currentUserRole, currentUserId);

    const employee = await SalaryHistoryRepository.findEmployee(employeeId);

    if (!employee) {
      throw new Error("Employee not found");
    }

    const targetDate = new Date(date);

    if (Number.isNaN(targetDate.getTime())) {
      throw new Error("Invalid date format. Use YYYY-MM-DD or ISO date format");
    }

    const salary = await SalaryHistoryRepository.resolveSalaryByDate(
      employeeId,
      targetDate,
    );

    if (!salary) {
      throw new Error("No salary history found for the selected date");
    }

    return {
      employee,
      targetDate,
      salary,
    };
  }

  static async updateSalaryHistory(
    id: string,
    data: {
      salaryAmount?: number;
      effectiveFrom?: string;
      correctionReason: string;
    },
    currentUserRole: Role,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can update salary history");
    }

    const existing = await SalaryHistoryRepository.findById(id);

    if (!existing) {
      throw new Error("Salary history record not found");
    }

    let effectiveFrom: Date | undefined;

    if (data.effectiveFrom) {
      effectiveFrom = new Date(data.effectiveFrom);

      if (Number.isNaN(effectiveFrom.getTime())) {
        throw new Error("Invalid effectiveFrom date format");
      }

      ensureDateOnOrAfterJoining({
        date: effectiveFrom,
        joiningDate: existing.employee.joiningDate,
        action: "Salary history effective date",
      });

      const duplicate =
        await SalaryHistoryRepository.findByEmployeeAndEffectiveDate(
          existing.employeeId,
          effectiveFrom,
        );

      if (duplicate && duplicate.id !== id) {
        throw new Error(
          "Another salary history already exists for this employee on this effective date",
        );
      }
    }

    await assertSalaryHistoryNotLocked({
      employeeId: existing.employeeId,
      effectiveFrom: existing.effectiveFrom,
    });

    if (effectiveFrom) {
      await assertSalaryHistoryNotLocked({
        employeeId: existing.employeeId,
        effectiveFrom,
      });
    }

    return SalaryHistoryRepository.update(id, {
      ...(data.salaryAmount !== undefined && {
        salaryAmount: data.salaryAmount,
      }),
      ...(effectiveFrom && {
        effectiveFrom,
      }),
    });
  }

  static async deleteSalaryHistory(
    id: string,
    currentUserRole: Role,
    reason?: string,
  ) {
    if (currentUserRole !== Role.SUPER_ADMIN) {
      throw new Error("Only SUPER_ADMIN can delete salary history");
    }

    if (!reason || reason.trim().length < 5) {
      throw new Error("Delete reason is required");
    }

    const existing = await SalaryHistoryRepository.findById(id);

    if (!existing) {
      throw new Error("Salary history record not found");
    }

    const histories = await SalaryHistoryRepository.listByEmployee(
      existing.employeeId,
    );

    if (histories.length <= 1) {
      throw new Error(
        "Cannot delete the only salary history record for this employee",
      );
    }

    await assertSalaryHistoryNotLocked({
      employeeId: existing.employeeId,
      effectiveFrom: existing.effectiveFrom,
    });

    return SalaryHistoryRepository.delete(id);
  }
}
