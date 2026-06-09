import { Request, Response, NextFunction } from "express";
import { SchedulerRunStatus } from "@prisma/client";
import { SchedulerService } from "./scheduler.service";
import { AuditLogService } from "../audit-logs/audit-log.service";
import { SchedulerRepository } from "./scheduler.repository";
import { payrollSchedulerQueue } from "../../jobs/payrollScheduler.queue";

export class SchedulerController {
  static async manualAdvanceReminders(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const result =
        await SchedulerService.getManualAdvanceDeductionReminders();

      res.json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  static async runPayroll(req: Request, res: Response, next: NextFunction) {
    try {
      await SchedulerService.recoverStaleRuns();

      const existingManualRun = await SchedulerRepository.findActiveRunByName(
        "MANUAL_PAYROLL_SCHEDULER",
      );
      const existingCronRun = await SchedulerRepository.findActiveRunByName(
        "CRON_PAYROLL_SCHEDULER",
      );

      if (existingManualRun || existingCronRun) {
        return res.status(409).json({
          success: false,
          message: "A payroll scheduler run is already in progress",
          data: existingManualRun || existingCronRun,
        });
      }

      const pendingPayrollCount =
        await SchedulerService.countPendingCurrentCyclePayrolls();

      if (pendingPayrollCount === 0) {
        return res.status(409).json({
          success: false,
          message:
            "All current payroll cycles are already handled. There is no payroll to generate.",
        });
      }

      const run = await SchedulerRepository.createRun({
        name: "MANUAL_PAYROLL_SCHEDULER",
        status: SchedulerRunStatus.PENDING,
        metadata: {
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString(),
          mode: "BACKGROUND",
        },
      });

      try {
        await payrollSchedulerQueue.add(
          "manual-payroll-run",
          {
            runId: run.id,
            triggeredBy: req.user.id,
            triggeredByType: "MANUAL",
          },
          {
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
        message: "Payroll scheduler started",
        jobId: run.id,
        status: run.status,
      });
    } catch (error) {
      next(error);
    }
  }

  static async runStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;

      if (!id || Array.isArray(id)) {
        res.status(400).json({
          success: false,
          message: "Scheduler run id is required",
        });
        return;
      }

      const run = await SchedulerService.getRunStatus(id);

      if (!run) {
        res.status(404).json({
          success: false,
          message: "Scheduler run not found",
        });
        return;
      }

      res.json({
        success: true,
        data: run,
      });
    } catch (error) {
      next(error);
    }
  }

  static async runs(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SchedulerService.listRuns(req.query);
      await AuditLogService.log({
        userId: req.user.id,
        action: "PAYROLL_GENERATE",
        module: "SCHEDULER",
        newData: {
          triggeredBy: "MANUAL",
          result,
        },
        ipAddress: req.ip,
      });
      res.json({
        success: true,
        message: "Scheduler runs fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  static async runItems(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;

      if (!id || Array.isArray(id)) {
        res.status(400).json({
          success: false,
          message: "Scheduler run id is required",
        });
        return;
      }

      const result = await SchedulerService.listRunItems(id, req.query);

      if (!result) {
        res.status(404).json({
          success: false,
          message: "Scheduler run not found",
        });
        return;
      }

      res.json({
        success: true,
        message: "Scheduler run items fetched successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }
}
