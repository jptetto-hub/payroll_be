"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../../config/prisma");
const env_1 = require("../../config/env");
class AuthService {
    static async login(phone, password) {
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { phone },
        });
        if (!employee) {
            throw new Error("Invalid phone number or password");
        }
        if (employee.status !== "ACTIVE") {
            throw new Error("Employee account is inactive");
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, employee.password);
        if (!isPasswordValid) {
            throw new Error("Invalid phone number or password");
        }
        const token = jsonwebtoken_1.default.sign({
            id: employee.id,
            phone: employee.phone,
            email: employee.email,
            role: employee.role,
        }, env_1.env.jwtSecret, {
            expiresIn: env_1.env.jwtExpiresIn,
        });
        return {
            token,
            employee: {
                id: employee.id,
                employeeCode: employee.employeeCode,
                name: employee.name,
                phone: employee.phone,
                email: employee.email,
                role: employee.role,
                joiningDate: employee.joiningDate,
                salaryType: employee.salaryType,
            },
        };
    }
    static async getMe(employeeId) {
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                employeeCode: true,
                name: true,
                email: true,
                phone: true,
                designation: true,
                department: true,
                joiningDate: true,
                salaryType: true,
                status: true,
                role: true,
                profileImage: true,
                createdAt: true,
            },
        });
        if (!employee) {
            throw new Error("Employee not found");
        }
        return employee;
    }
}
exports.AuthService = AuthService;
//# sourceMappingURL=auth.service.js.map