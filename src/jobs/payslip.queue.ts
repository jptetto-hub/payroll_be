import { Queue } from "bullmq";
import { redisConnection } from "./payrollScheduler.queue";

export const payslipQueue = new Queue("payslip-generation", {
  connection: redisConnection,
});
