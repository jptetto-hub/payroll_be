export class PerformanceTimer {
  private readonly label: string;
  private readonly startedAt: bigint;
  private lastCheckpointAt: bigint;

  constructor(label: string) {
    this.label = label;
    this.startedAt = process.hrtime.bigint();
    this.lastCheckpointAt = this.startedAt;
  }

  checkpoint(step: string) {
    if (process.env.ENABLE_PERFORMANCE_LOG !== "true") {
      return;
    }

    const now = process.hrtime.bigint();
    const stepDurationMs = Number(now - this.lastCheckpointAt) / 1_000_000;
    const totalDurationMs = Number(now - this.startedAt) / 1_000_000;

    console.log("PERFORMANCE_CHECKPOINT", {
      label: this.label,
      step,
      stepDuration: `${stepDurationMs.toFixed(2)}ms`,
      totalDuration: `${totalDurationMs.toFixed(2)}ms`,
    });

    this.lastCheckpointAt = now;
  }

  end() {
    if (process.env.ENABLE_PERFORMANCE_LOG !== "true") {
      return;
    }

    const now = process.hrtime.bigint();
    const totalDurationMs = Number(now - this.startedAt) / 1_000_000;

    console.log("PERFORMANCE_END", {
      label: this.label,
      totalDuration: `${totalDurationMs.toFixed(2)}ms`,
    });
  }
}
