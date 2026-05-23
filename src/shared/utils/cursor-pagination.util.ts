import { AppError } from "./app-error";

export type CursorPaginationQuery = {
  cursor?: string | number;
  limit?: string | number;
};

export type CursorPaginationMeta = {
  limit: number;
  nextCursor: string | null;
  hasNextPage: boolean;
};

export const DEFAULT_CURSOR_LIMIT = 50;
export const MAX_CURSOR_LIMIT = 100;

export const getCursorPagination = (query: CursorPaginationQuery) => {
  const rawLimit = Number(query.limit ?? DEFAULT_CURSOR_LIMIT);

  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new AppError("limit must be a positive number", 400);
  }

  return {
    limit: Math.min(rawLimit, MAX_CURSOR_LIMIT),
    cursor: query.cursor ? String(query.cursor) : undefined,
  };
};

export const buildCursorPaginationMeta = <T extends { id: string }>(
  items: T[],
  limit: number,
): { data: T[]; pagination: CursorPaginationMeta } => {
  const hasNextPage = items.length > limit;
  const data = hasNextPage ? items.slice(0, limit) : items;
  const last = data[data.length - 1];

  return {
    data,
    pagination: {
      limit,
      nextCursor: hasNextPage && last ? last.id : null,
      hasNextPage,
    },
  };
};
