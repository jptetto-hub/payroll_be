import { ReportsRepository } from "./reports.repository";
import { generateCSV } from "../../utils/export/csv";
import { generateExcelBuffer } from "../../utils/export/excel";
import {
  getPagination,
  type PaginationQuery,
} from "../../shared/utils/pagination.util";
import { resolveEmployeeScope } from "../../shared/utils/employee-scope.util";
import { AppError } from "../../shared/utils/app-error";

const parseFromDate = (value?: string) =>
  value ? new Date(`${value}T00:00:00.000Z`) : undefined;

const parseToDate = (value?: string) =>
  value ? new Date(`${value}T23:59:59.999Z`) : undefined;

const normalizeReportQuery = (query: any, authUser: any, paginate = true) => {
  const { employeeWhere } = resolveEmployeeScope({
    authUser,
    employeeId: query.employeeId as string | undefined,
  });

  let pagination;

  try {
    pagination = getPagination(query as PaginationQuery);
  } catch {
    throw new AppError("Invalid pagination parameters", 400);
  }

  const fromDate = parseFromDate(query.from as string | undefined);
  const toDate = parseToDate(query.to as string | undefined);

  if (fromDate && Number.isNaN(fromDate.getTime())) {
    throw new AppError("Invalid from date. Use YYYY-MM-DD", 400);
  }

  if (toDate && Number.isNaN(toDate.getTime())) {
    throw new AppError("Invalid to date. Use YYYY-MM-DD", 400);
  }

  if (fromDate && toDate && fromDate > toDate) {
    throw new AppError("from date cannot be greater than to date", 400);
  }

  return {
    employeeWhere,
    fromDate,
    toDate,
    page: pagination.page,
    limit: pagination.limit,
    skip: pagination.skip,
    take: pagination.take,
    paginate,
  };
};

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const salaryExportColumns = [
  { header: "Employee Code", key: "employeeCode", width: 18 },
  { header: "Name", key: "name", width: 25 },
  { header: "Salary Type", key: "salaryType", width: 15 },
  { header: "Period Start", key: "periodStart", width: 15 },
  { header: "Period End", key: "periodEnd", width: 15 },
  { header: "Gross Salary", key: "grossSalary", width: 15 },
  { header: "Advance Deduction", key: "advanceDeduction", width: 20 },
  { header: "Carry Forward Applied", key: "carryForwardApplied", width: 24 },
  { header: "Total Deduction", key: "totalDeduction", width: 18 },
  { header: "Raw Final Salary", key: "rawFinalSalary", width: 18 },
  { header: "Final Salary", key: "finalSalary", width: 15 },
  {
    header: "Carry Forward Deduction",
    key: "carryForwardDeduction",
    width: 26,
  },
  { header: "Payroll Status", key: "payrollStatus", width: 18 },
];

const salaryExportKeys = [
  "employeeCode",
  "name",
  "salaryType",
  "periodStart",
  "periodEnd",
  "grossSalary",
  "advanceDeduction",
  "carryForwardApplied",
  "totalDeduction",
  "rawFinalSalary",
  "finalSalary",
  "carryForwardDeduction",
  "payrollStatus",
];

const formatPayrollForExport = (p: any) => ({
  employeeCode: p.employee.employeeCode,
  name: p.employee.name,
  salaryType: p.employee.salaryType,
  periodStart: formatDate(p.periodStart),
  periodEnd: formatDate(p.periodEnd),
  grossSalary: Number(p.grossSalary),
  advanceDeduction: Number(p.advanceDeduction),
  carryForwardApplied: Number(p.carryForwardApplied),
  totalDeduction: Number(p.totalDeduction),
  rawFinalSalary: Number(p.rawFinalSalary),
  finalSalary: Number(p.finalSalary),
  carryForwardDeduction: Number(p.carryForwardDeduction),
  payrollStatus: p.status,
});

const formatAllInOne = (p: any) => ({
  employeeCode: p.employee.employeeCode,
  name: p.employee.name,
  salaryType: p.employee.salaryType,
  periodStart: formatDate(p.periodStart),
  periodEnd: formatDate(p.periodEnd),
  grossSalary: Number(p.grossSalary),
  advanceDeduction: Number(p.advanceDeduction),
  carryForwardApplied: Number(p.carryForwardApplied),
  totalDeduction: Number(p.totalDeduction),
  rawFinalSalary: Number(p.rawFinalSalary),
  finalSalary: Number(p.finalSalary),
  carryForwardDeduction: Number(p.carryForwardDeduction),
  payrollStatus: p.status,
});

export class ReportsService {
  static async salary(query: any, authUser: any) {
    return ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async salaryExport(query: any, authUser: any) {
    const result = await ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateCSV(
      (result.data as any[]).map(formatPayrollForExport),
      salaryExportKeys,
    );
  }

  static async attendance(query: any, authUser: any) {
    return ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async attendanceExport(query: any, authUser: any) {
    const result = await ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      date: formatDate(a.date),
      status: a.status,
    }));

    return generateCSV(formatted, [
      "employeeCode",
      "name",
      "salaryType",
      "date",
      "status",
    ]);
  }

  static async advance(query: any, authUser: any) {
    return ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser),
    );
  }

  static async advanceExport(query: any, authUser: any) {
    const result = await ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      amount: Number(a.amount),
      remainingAmount: Number(a.remainingAmount),
      settledAmount: Number(a.settledAmount),
      carryForwardAmount: Number(a.carryForwardAmount),
      settlementStatus: a.settlementStatus,
      lockedByPayrollId: a.lockedByPayrollId,
      date: formatDate(a.date),
      payCycleType: a.payCycleType,
      cycleStartDate: formatDate(a.cycleStartDate),
      cycleEndDate: formatDate(a.cycleEndDate),
      isSettled: a.isSettled ? "Yes" : "No",
    }));

    return generateCSV(formatted, [
      "employeeCode",
      "name",
      "salaryType",
      "amount",
      "remainingAmount",
      "settledAmount",
      "carryForwardAmount",
      "settlementStatus",
      "lockedByPayrollId",
      "date",
      "payCycleType",
      "cycleStartDate",
      "cycleEndDate",
      "isSettled",
    ]);
  }

  static async salaryExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.salaryReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateExcelBuffer(
      "Salary Report",
      salaryExportColumns,
      (result.data as any[]).map(formatPayrollForExport),
    );
  }

  static async attendanceExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.attendanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      date: formatDate(a.date),
      status: a.status,
    }));

    return generateExcelBuffer(
      "Attendance Report",
      [
        { header: "Employee Code", key: "employeeCode", width: 18 },
        { header: "Name", key: "name", width: 25 },
        { header: "Salary Type", key: "salaryType", width: 15 },
        { header: "Date", key: "date", width: 15 },
        { header: "Status", key: "status", width: 15 },
      ],
      formatted,
    );
  }

  static async advanceExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.advanceReport(
      normalizeReportQuery(query, authUser, false),
    );

    const formatted = (result.data as any[]).map((a) => ({
      employeeCode: a.employee.employeeCode,
      name: a.employee.name,
      salaryType: a.employee.salaryType,
      amount: Number(a.amount),
      remainingAmount: Number(a.remainingAmount),
      settledAmount: Number(a.settledAmount),
      carryForwardAmount: Number(a.carryForwardAmount),
      settlementStatus: a.settlementStatus,
      lockedByPayrollId: a.lockedByPayrollId,
      date: formatDate(a.date),
      payCycleType: a.payCycleType,
      cycleStartDate: formatDate(a.cycleStartDate),
      cycleEndDate: formatDate(a.cycleEndDate),
      isSettled: a.isSettled ? "Yes" : "No",
    }));

    return generateExcelBuffer(
      "Advance Report",
      [
        { header: "Employee Code", key: "employeeCode", width: 18 },
        { header: "Name", key: "name", width: 25 },
        { header: "Salary Type", key: "salaryType", width: 15 },
        { header: "Amount", key: "amount", width: 15 },
        { header: "Remaining Amount", key: "remainingAmount", width: 20 },
        { header: "Settled Amount", key: "settledAmount", width: 18 },
        { header: "Carry Forward Amount", key: "carryForwardAmount", width: 24 },
        { header: "Settlement Status", key: "settlementStatus", width: 22 },
        { header: "Locked By Payroll", key: "lockedByPayrollId", width: 38 },
        { header: "Date", key: "date", width: 15 },
        { header: "Pay Cycle Type", key: "payCycleType", width: 18 },
        { header: "Cycle Start Date", key: "cycleStartDate", width: 18 },
        { header: "Cycle End Date", key: "cycleEndDate", width: 18 },
        { header: "Settled", key: "isSettled", width: 12 },
      ],
      formatted,
    );
  }

  static async allInOne(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser),
    );

    return {
      ...result,
      data: (result.data as any[]).map(formatAllInOne),
    };
  }

  static async allInOneExport(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateCSV((result.data as any[]).map(formatAllInOne), [
      "employeeCode",
      "name",
      "salaryType",
      "periodStart",
      "periodEnd",
      "grossSalary",
      "advanceDeduction",
      "carryForwardApplied",
      "totalDeduction",
      "rawFinalSalary",
      "finalSalary",
      "carryForwardDeduction",
      "payrollStatus",
    ]);
  }

  static async allInOneExportExcel(query: any, authUser: any) {
    const result = await ReportsRepository.allInOneReport(
      normalizeReportQuery(query, authUser, false),
    );

    return generateExcelBuffer(
      "All In One Report",
      salaryExportColumns,
      (result.data as any[]).map(formatAllInOne),
    );
  }
}
