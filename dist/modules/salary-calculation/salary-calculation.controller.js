"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalaryCalculationController = void 0;
const salary_calculation_service_1 = require("./salary-calculation.service");
class SalaryCalculationController {
    static async preview(req, res, next) {
        try {
            const result = await salary_calculation_service_1.SalaryCalculationService.preview(req.body);
            res.json({
                success: true,
                message: "Salary calculation preview generated successfully",
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SalaryCalculationController = SalaryCalculationController;
//# sourceMappingURL=salary-calculation.controller.js.map