"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayrollCarryForwardRepository = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../../config/prisma");
class PayrollCarryForwardRepository {
    static findPendingByEmployee(employeeId, targetPeriodStart) {
        return prisma_1.prisma.payrollCarryForward.findMany({
            where: {
                employeeId,
                ...(targetPeriodStart && {
                    cycleEndDate: {
                        lt: targetPeriodStart,
                    },
                }),
                status: {
                    in: [
                        client_1.CarryForwardStatus.PENDING,
                        client_1.CarryForwardStatus.PARTIALLY_DEDUCTED,
                    ],
                },
                remainingAmount: {
                    gt: 0,
                },
            },
            orderBy: {
                createdAt: "asc",
            },
        });
    }
}
exports.PayrollCarryForwardRepository = PayrollCarryForwardRepository;
//# sourceMappingURL=payroll-carry-forward.repository.js.map