"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    errors;
    constructor(message, statusCode = 400, errors = []) {
        super(message);
        this.statusCode = statusCode;
        this.errors = errors;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
//# sourceMappingURL=app-error.js.map