"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginationMeta = exports.getPagination = exports.MAX_PAGE_SIZE = exports.DEFAULT_PAGE_SIZE = void 0;
const app_error_1 = require("./app-error");
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_PAGE_SIZE = 100;
const getPagination = (query) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? exports.DEFAULT_PAGE_SIZE);
    if (!Number.isInteger(page) || page < 1) {
        throw new app_error_1.AppError("page must be a positive number", 400);
    }
    if (!Number.isInteger(limit) || limit < 1) {
        throw new app_error_1.AppError("limit must be a positive number", 400);
    }
    const safeLimit = Math.min(limit, exports.MAX_PAGE_SIZE);
    const skip = (page - 1) * safeLimit;
    return {
        page,
        limit: safeLimit,
        skip,
        take: safeLimit,
    };
};
exports.getPagination = getPagination;
const buildPaginationMeta = (total, page, limit) => {
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
exports.buildPaginationMeta = buildPaginationMeta;
//# sourceMappingURL=pagination.util.js.map