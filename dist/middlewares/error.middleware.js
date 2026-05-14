"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.errorHandler = void 0;
const zod_1 = require("zod");
const app_error_1 = require("../shared/utils/app-error");
const errorHandler = (error, _req, res, _next) => {
    if (error instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            message: "Validation error",
            errors: error.issues,
        });
    }
    const message = error?.message || "Internal server error";
    const statusCode = error instanceof app_error_1.AppError
        ? error.statusCode
        : error?.statusCode
            ? error.statusCode
            : message.includes("Unauthorized")
                ? 401
                : message.includes("Forbidden")
                    ? 403
                    : message.includes("not found")
                        ? 404
                        : 400;
    return res.status(statusCode).json({
        success: false,
        message,
        errors: error instanceof app_error_1.AppError ? error.errors : error?.errors || [],
    });
};
exports.errorHandler = errorHandler;
exports.errorMiddleware = exports.errorHandler;
//# sourceMappingURL=error.middleware.js.map