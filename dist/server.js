"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const env_1 = require("./config/env");
const payroll_cron_1 = require("./cron/payroll.cron");
app_1.default.listen(env_1.env.port, () => {
    console.log(`Server running on port ${env_1.env.port}`);
    (0, payroll_cron_1.startPayrollCron)();
});
//# sourceMappingURL=server.js.map