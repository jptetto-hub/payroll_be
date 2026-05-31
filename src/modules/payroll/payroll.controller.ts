import { Request, Response, NextFunction } from "express";
import { PayrollService } from "./payroll.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { SchedulerRunStatus } from "@prisma/client";
import { SchedulerRepository } from "../scheduler/scheduler.repository";
import { payrollSchedulerQueue } from "../../jobs/payrollScheduler.queue";
import { PayrollRepository } from "./payroll.repository";

type PayrollParams = {
  id: string;
};

type EmployeeParams = {
  employeeId: string;
};

export class PayrollController {
  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const existingRun = await SchedulerRepository.findActiveSinglePayrollRun({
        employeeId: req.body.employeeId,
        periodStart: req.body.periodStart,
        periodEnd: req.body.periodEnd,
      });

      if (existingRun) {
        return res.status(202).json({
          success: true,
          message: "Payroll generation is already queued",
          data: {
            jobId: existingRun.id,
            status: existingRun.status,
            reused: true,
          },
        });
      }

      const existingPayroll = await PayrollRepository.findActivePayroll(
        req.body.employeeId,
        new Date(`${req.body.periodStart}T00:00:00.000Z`),
        new Date(`${req.body.periodEnd}T00:00:00.000Z`),
      );

      if (existingPayroll) {
        return res.status(409).json({
          success: false,
          message: "Active payroll already exists for this employee and period",
          data: {
            payrollId: existingPayroll.id,
            status: existingPayroll.status,
          },
        });
      }

      const run = await SchedulerRepository.createRun({
        name: "MANUAL_SINGLE_PAYROLL_GENERATION",
        status: SchedulerRunStatus.PENDING,
        totalEmployees: 1,
        metadata: {
          mode: "BACKGROUND",
          employeeId: req.body.employeeId,
          periodStart: req.body.periodStart,
          periodEnd: req.body.periodEnd,
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString(),
        },
      });

      try {
        await payrollSchedulerQueue.add(
          "single-payroll-generation",
          {
            runId: run.id,
            employeeId: req.body.employeeId,
            periodStart: req.body.periodStart,
            periodEnd: req.body.periodEnd,
            currentUserRole: req.user.role,
            userId: req.user.id,
            ipAddress: req.ip,
          },
          {
            jobId: run.id,
            attempts: 1,
            removeOnComplete: false,
            removeOnFail: false,
          },
        );
      } catch (error) {
        await SchedulerRepository.updateRun(run.id, {
          status: SchedulerRunStatus.FAILED,
          completedAt: new Date(),
          errorMessage:
            error instanceof Error ? error.message : "Failed to enqueue job",
        });

        throw error;
      }

      res.status(202).json({
        success: true,
        message: "Payroll generation queued",
        data: {
          jobId: run.id,
          status: run.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PayrollService.list(req.query, req.user);

      res.json({
        success: true,
        message: "Payrolls fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.getById(req.params.id);

      res.json({
        success: true,
        message: "Payroll fetched successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async listByEmployee(
    req: Request<EmployeeParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.listByEmployee(
        req.params.employeeId,
        req.user.role,
        req.query,
      );

      res.json({
        success: true,
        message: "Employee payrolls fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.cancelPayroll(
        req.params.id,
        req.user.role,
        req.body.reason,
        req.user.id,
        req.ip,
      );

      res.json({
        success: true,
        message: "Payroll cancelled successfully and related records unlocked",
        data: {
          payroll: result.payroll,
          unlocked: result.unlocked,
          reversedAdvances: result.reversedAdvances,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async recalculate(
    req: Request<PayrollParams>,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result = await PayrollService.recalculatePayroll(
        req.params.id,
        req.user.role,
        req.body.reason,
        req.user.id,
      );
      await AuditLogService.log({
        userId: req.user.id,
        action: "PAYROLL_RECALCULATE",
        module: "PAYROLL",
        newData: {
          recalculation: result,
          reason: req.body.reason,
        },
        ipAddress: req.ip,
        skipRelationValidation: true,
      });
      res.json({
        success: true,
        message: "Payroll recalculated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
