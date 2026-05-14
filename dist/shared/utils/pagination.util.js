"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPaginationMeta = exports.getPagination = void 0;
const app_error_1 = require("./app-error");
const getPagination = (query) => {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1) {
        throw new app_error_1.AppError("page must be a positive number", 400);
    }
    if (!Number.isInteger(limit) || limit < 1) {
        throw new app_error_1.AppError("limit must be a positive number", 400);
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