/** One telemetry worker slot represents up to 1.5M simulated frames. This
 * keeps `--jobs` as a maximum while preventing simultaneous high-budget
 * compiles from oversubscribing memory. Both summary and trace retain the
 * repair-decision episode graph and have comparable live worker heaps; trace
 * mainly enlarges the durable artifact. Telemetry-off diagnostics retain
 * ordinary one-worker slots. */
export function scaleWorkerSlotWeight(
  budget: number,
  telemetry: "off" | "summary" | "trace",
): number {
  if (telemetry === "off") return 1;
  return Math.max(1, Math.ceil(budget / 1_500_000));
}

export async function runWeightedPool<T>(
  tasks: readonly T[],
  slotCapacity: number,
  weightOf: (task: T) => number,
  runTask: (task: T) => Promise<void>,
): Promise<void> {
  if (!Number.isSafeInteger(slotCapacity) || slotCapacity < 1) {
    throw new Error(`weighted pool slot capacity must be a positive integer`);
  }
  let next = 0;
  let active = 0;
  let occupiedSlots = 0;
  await new Promise<void>((resolve, reject) => {
    let failed = false;
    const launch = (): void => {
      if (failed) return;
      while (next < tasks.length) {
        const task = tasks[next]!;
        const requestedWeight = weightOf(task);
        if (!Number.isSafeInteger(requestedWeight) || requestedWeight < 1) {
          failed = true;
          reject(new Error(`weighted pool task weight must be a positive integer`));
          return;
        }
        // A task heavier than the entire pool still runs alone.
        const weight = Math.min(slotCapacity, requestedWeight);
        if (active > 0 && occupiedSlots + weight > slotCapacity) break;
        next++;
        active++;
        occupiedSlots += weight;
        void runTask(task).then(() => {
          active--;
          occupiedSlots -= weight;
          if (next === tasks.length && active === 0) resolve();
          else launch();
        }, (error) => {
          if (failed) return;
          failed = true;
          reject(error);
        });
      }
      if (next === tasks.length && active === 0) resolve();
    };
    launch();
  });
}
