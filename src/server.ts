import app from "./app";
import { env } from "./config/env";
import { startPayrollCron } from "./cron/payroll.cron";

app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);

  startPayrollCron().catch((error) => {
    console.error("Payroll scheduler failed to start", error);
  });
});
