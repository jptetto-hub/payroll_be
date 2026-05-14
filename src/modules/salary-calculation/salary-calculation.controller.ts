import { Request, Response, NextFunction } from "express";
import { SalaryCalculationService } from "./salary-calculation.service";

export class SalaryCalculationController {
  static async preview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await SalaryCalculationService.preview(req.body);

      res.json({
        success: true,
        message: "Salary calculation preview generated successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
