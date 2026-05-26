import { CarryForwardStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";

export class PayrollCarryForwardRepository {
  static findPendingByEmployee(employeeId: string, targetPeriodStart?: Date) {
    return prisma.payrollCarryForward.findMany({
      where: {
        employeeId,
        ...(targetPeriodStart && {
          cycleEndDate: {
            lt: targetPeriodStart,
          },
        }),
        status: {
          in: [
            CarryForwardStatus.PENDING,
            CarryForwardStatus.PARTIALLY_DEDUCTED,
          ],
        },
        remainingAmount: {
          gt: 0,
        },
      },
      orderBy: [{ cycleEndDate: "asc" }, { createdAt: "asc" }],
    });
  }
}
