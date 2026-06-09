"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payslipQueue = void 0;
const bullmq_1 = require("bullmq");
const payrollScheduler_queue_1 = require("./payrollScheduler.queue");
exports.payslipQueue = new bullmq_1.Queue("payslip-generation", {
    connection: payrollScheduler_queue_1.redisConnection,
});
//# sourceMappingURL=payslip.queue.js.map