import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { WeekStartsOn } from "@prisma/client";
import { AppError } from "../utils/app-error";

dayjs.extend(utc);

const WEEKLY_PAYROLL_ERROR =
  "Weekly payroll must be a valid week cycle ending on Saturday";

export const getWeeklyCycleEnd = (cycleStartDate: Date | string) => {
  return dayjs.utc(cycleStartDate).day(6).endOf("day").toDate();
};

export const isValidWeeklyCycle = (
  periodStart: Date | string,
  periodEnd: Date | string,
  weekStartsOn: WeekStartsOn,
) => {
  const start = dayjs.utc(periodStart).startOf("day");
  const end = dayjs.utc(periodEnd).startOf("day");

  const expectedStartDay = weekStartsOn === WeekStartsOn.MONDAY ? 1 : 0;
  const expectedEndDay = 6;

  return start.day() === expectedStartDay && end.day() === expectedEndDay;
};

export const validateWeeklyPayrollCycle = (
  periodStart: Date | string,
  periodEnd: Date | string,
  weekStartsOn: WeekStartsOn,
) => {
  const start = dayjs.utc(periodStart).startOf("day");
  const end = dayjs.utc(periodEnd).startOf("day");
  const expectedEnd = dayjs.utc(periodStart).day(6).startOf("day");

  if (!isValidWeeklyCycle(start.toDate(), end.toDate(), weekStartsOn)) {
    throw new AppError(WEEKLY_PAYROLL_ERROR, 400);
  }

  if (!end.isSame(expectedEnd, "day")) {
    throw new AppError(WEEKLY_PAYROLL_ERROR, 400);
  }

  return {
    periodStart: start.toDate(),
    periodEnd: end.endOf("day").toDate(),
  };
};
