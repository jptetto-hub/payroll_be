"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveEmployeeScope = void 0;
const client_1 = require("@prisma/client");
const app_error_1 = require("./app-error");
const resolveEmployeeScope = ({ authUser, employeeId, }) => {
    if (!employeeId) {
        if (authUser.role === client_1.Role.USER) {
            return {
                employeeWhere: {
                    id: authUser.id,
                },
            };
        }
        if (authUser.role === client_1.Role.ADMIN) {
            return {
                employeeWhere: {
                    role: client_1.Role.USER,
                },
            };
        }
        return {
            employeeWhere: {},
        };
    }
    if (employeeId === "all") {
        if (authUser.role === client_1.Role.USER) {
            throw new app_error_1.AppError("USER cannot access all employees data", 403);
        }
        if (authUser.role === client_1.Role.ADMIN) {
            return {
                employeeWhere: {
                    role: client_1.Role.USER,
                },
            };
        }
        return {
            employeeWhere: {},
        };
    }
    if (authUser.role === client_1.Role.USER && employeeId !== authUser.id) {
        throw new app_error_1.AppError("You can access only your own data", 403);
    }
    if (authUser.role === client_1.Role.ADMIN) {
        return {
            employeeWhere: {
                id: employeeId,
                role: client_1.Role.USER,
            },
        };
    }
    return {
        employeeWhere: {
            id: employeeId,
        },
    };
};
exports.resolveEmployeeScope = resolveEmployeeScope;
//# sourceMappingURL=employee-scope.util.js.map