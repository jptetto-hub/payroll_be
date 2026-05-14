import { AppError } from "./app-error";

export type PaginationQuery = {
  page?: string | number;
  limit?: string | number;
};

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export const getPagination = (query: PaginationQuery) => {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 10);

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError("page must be a positive number", 400);
  }

  if (!Number.isInteger(limit) || limit < 1) {
    throw new AppError("limit must be a positive number", 400);
  }

  const safeLimit = Math.min(limit, 100);
  const skip = (page - 1) * safeLimit;

  return {
    page,
    limit: safeLimit,
    skip,
    take: safeLimit,
  };
};

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => {
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
