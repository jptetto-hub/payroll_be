"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCursorPaginationMeta = exports.getCursorPagination = exports.MAX_CURSOR_LIMIT = exports.DEFAULT_CURSOR_LIMIT = void 0;
const app_error_1 = require("./app-error");
exports.DEFAULT_CURSOR_LIMIT = 50;
exports.MAX_CURSOR_LIMIT = 100;
const getCursorPagination = (query) => {
    const rawLimit = Number(query.limit ?? exports.DEFAULT_CURSOR_LIMIT);
    if (!Number.isInteger(rawLimit) || rawLimit < 1) {
        throw new app_error_1.AppError("limit must be a positive number", 400);
    }
    return {
        limit: Math.min(rawLimit, exports.MAX_CURSOR_LIMIT),
        cursor: query.cursor ? String(query.cursor) : undefined,
    };
};
exports.getCursorPagination = getCursorPagination;
const buildCursorPaginationMeta = (items, limit) => {
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
exports.buildCursorPaginationMeta = buildCursorPaginationMeta;
//# sourceMappingURL=cursor-pagination.util.js.map