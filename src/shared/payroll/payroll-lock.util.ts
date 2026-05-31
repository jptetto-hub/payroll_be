import { PayrollStatus, SalaryType } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../utils/app-error";

const ACTIVE_LOCK_STATUSES: PayrollStatus[] = [
  PayrollStatus.GENERATED,
  PayrollStatus.PAID,
];

export const findActivePayrollForDate = async (
  employeeId: string,
  date: Date,
) => {
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return prisma.payroll.findFirst({
    where: {
      employeeId,
      status: {
        in: ACTIVE_LOCK_STATUSES,
      },
      OR: [
        {
          periodStart: {
            lte: date,
          },
          periodEnd: {
            gte: date,
          },
        },
        ...(date.getUTCDay() === 0
          ? [
              {
                salaryType: SalaryType.WEEKLY,
                periodStart: nextDay,
              },
            ]
          : []),
      ],
    },
  });
};

export const isAttendanceDateLockedByPayroll = (
  payroll: {
    salaryType: SalaryType;
    periodStart: Date;
    periodEnd: Date;
  },
  date: Date,
) => {
  if (payroll.periodStart <= date && payroll.periodEnd >= date) {
    return true;
  }

  if (payroll.salaryType !== SalaryType.WEEKLY || date.getUTCDay() !== 0) {
    return false;
  }

  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  return payroll.periodStart.getTime() === nextDay.getTime();
};

export const findActivePayrollForCycle = async ({
  employeeId,
  cycleStartDate,
  cycleEndDate,
}: {
  employeeId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
}) => {
  return prisma.payroll.findFirst({
    where: {
      employeeId,
      status: {
        in: ACTIVE_LOCK_STATUSES,
      },
      periodStart: cycleStartDate,
      periodEnd: cycleEndDate,
    },
  });
};

export const assertAttendanceNotLocked = async (
  employeeId: string,
  date: Date,
) => {
  const payroll = await findActivePayrollForDate(employeeId, date);

  if (payroll) {
    throw new AppError(
      "Attendance is locked because payroll is already generated for this period. Cancel or recalculate payroll before editing.",
      400,
    );
  }
};

export const assertAttendanceApprovalNotLocked = async (
  employeeId: string,
  date: Date,
) => {
  const payroll = await findActivePayrollForDate(employeeId, date);

  if (payroll) {
    throw new AppError(
      "Cannot approve attendance request because payroll already exists for this attendance period. Cancel or recalculate payroll first.",
      400,
    );
  }
};

export const assertAttendanceRequestNotLocked = async (
  employeeId: string,
  date: Date,
) => {
  const payroll = await findActivePayrollForDate(employeeId, date);

  if (payroll) {
    throw new AppError(
      "Cannot submit attendance request because payroll already exists for this attendance period. Cancel or recalculate payroll first.",
      400,
    );
  }
};

export const assertAdvanceCycleNotLocked = async ({
  employeeId,
  cycleStartDate,
  cycleEndDate,
}: {
  employeeId: string;
  cycleStartDate: Date;
  cycleEndDate: Date;
}) => {
  const payroll = await findActivePayrollForCycle({
    employeeId,
    cycleStartDate,
    cycleEndDate,
  });

  if (payroll) {
    throw new AppError(
      "Advance is locked because payroll is already generated for this deduction cycle. Cancel payroll before editing advance.",
      400,
    );
  }
};

export const assertSalaryHistoryNotLocked = async ({
  employeeId,
  effectiveFrom,
}: {
  employeeId: string;
  effectiveFrom: Date;
}) => {
  const payroll = await findActivePayrollForDate(employeeId, effectiveFrom);

  if (payroll) {
    throw new AppError(
      "Salary history is locked because payroll already exists for the affected period. Use payroll recalculation workflow.",
      400,
    );
  }
};
