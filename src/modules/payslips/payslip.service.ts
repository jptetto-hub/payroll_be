import { PayrollStatus, Role } from "@prisma/client";
import { PayslipRepository } from "./payslip.repository";
import {
  buildPaginationMeta,
  getPagination,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";

const ensureEmployeeAccess = (targetRole: Role, currentRole: Role) => {
  if (currentRole === Role.ADMIN && targetRole !== Role.USER) {
    throw new Error("ADMIN can access payslips only for USER employees");
  }
};

export class PayslipService {
  static async createFromPayroll(payrollId: string) {
    const payroll = await PayslipRepository.findPayroll(payrollId);

    if (!payroll) {
      throw new Error("Payroll not found");
    }

    if (payroll.status === PayrollStatus.CANCELLED) {
      throw new Error("Cannot create payslip for cancelled payroll");
    }

    if (payroll.status === PayrollStatus.SUPERSEDED) {
      throw new Error("Cannot create payslip for superseded payroll");
    }

    const existing = await PayslipRepository.findByPayroll(payrollId);

    if (existing) {
      throw new Error("Payslip already exists for this payroll");
    }

    return PayslipRepository.createFromPayroll(payroll);
  }

  static async list(query: any, authUser: { id: string; role: Role }) {
    const { page, limit, skip, take } = getPagination(query);
    const { employeeWhere } = resolveEmployeeScope({
      authUser,
      employeeId: query.employeeId,
    });

    const [payslips, total] = await PayslipRepository.listAll({
      skip,
      take,
      employeeWhere,
    });

    return {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }

  static async myPayslips(employeeId: string, query: any) {
    const { page, limit, skip, take } = getPagination(query);
    const [payslips, total] = await Promise.all([
      PayslipRepository.listByEmployee(employeeId, { skip, take }),
      PayslipRepository.countByEmployee(employeeId),
    ]);

    return {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };
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
    const [payslips, total] = await Promise.all([
      PayslipRepository.listByEmployee(employeeId, { skip, take }),
      PayslipRepository.countByEmployee(employeeId),
    ]);

    return {
      data: payslips,
      pagination: buildPaginationMeta(total, page, limit),
    };
  }
}
