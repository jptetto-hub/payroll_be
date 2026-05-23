import { AppError } from "../shared/utils/app-error";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const parseDateStart = (value: string) => new Date(`${value}T00:00:00.000Z`);
const parseDateEnd = (value: string) => new Date(`${value}T23:59:59.999Z`);

export function parseRequiredDateRange(query: any, maxDays = 31) {
  if (!query.from || !query.to) {
    throw new AppError("from and to date are required", 400);
  }

  const from = parseDateStart(String(query.from));
  const to = parseDateEnd(String(query.to));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new AppError("Invalid from or to date. Use YYYY-MM-DD", 400);
  }

  if (from > to) {
    throw new AppError("from date cannot be greater than to date", 400);
  }

  const diffDays = Math.ceil((to.getTime() - from.getTime()) / MS_PER_DAY);

  if (diffDays > maxDays) {
    throw new AppError(`Date range cannot exceed ${maxDays} days`, 400);
  }

  return { from, to };
}
