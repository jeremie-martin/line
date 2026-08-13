import { createHash } from "node:crypto";
import { createReadStream, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import { createInterface } from "node:readline";
import { gzipSync } from "node:zlib";
import { writeFileAtomicDurable } from "./durable_fs.ts";
import { scaleAnalysisRun } from "./scale_analysis_projection.ts";

/** Migrate a pre-aggregate trace projection without loading its much larger
 * full archive. The durable JSONL checkpoint is the authoritative source for
 * the omitted node events; score, report, and compiler identity are unchanged. */
async function main(): Promise<void> {
  const archive = resolve(requiredArgument("archive"));
  const analysis = archive.endsWith(".json")
    ? `${archive.slice(0, -5)}.analysis.json`
    : `${archive}.analysis.json`;
  const checkpoint = resolve(argument("checkpoint") ?? `${archive}.checkpoint.jsonl`);
  const report = JSON.parse(readFileSync(analysis, "utf8"));
  if (!Array.isArray(report?.runs)) throw new Error(`${analysis}: missing runs`);

  const summaries = new Map<string, unknown>();
  const lines = createInterface({ input: createReadStream(checkpoint), crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim() === "") continue;
    const record = JSON.parse(line);
    if (record?.type !== "result" || record?.result?.status !== "ok") continue;
    const projected = scaleAnalysisRun(record.result) as any;
    const summary = projected?.budgetTelemetry?.repair_node_policy;
    if (summary !== undefined) summaries.set(runKey(record.result.task), summary);
  }

  let migrated = 0;
  for (const row of report.runs) {
    const summary = summaries.get(runKey(row.task));
    if (summary === undefined || row?.budgetTelemetry === null) continue;
    row.budgetTelemetry.repair_node_policy = summary;
    migrated++;
  }
  if (migrated !== summaries.size || migrated === 0) {
    throw new Error(
      `${basename(analysis)}: migrated ${migrated}/${summaries.size} trace rows from checkpoint`,
    );
  }
  if (Array.isArray(report.analysisProjection?.omitted)) {
    report.analysisProjection.omitted = report.analysisProjection.omitted.map((value: unknown) =>
      value === "budget-telemetry node events"
        ? "budget-telemetry node events (compact repair position aggregates retained)"
        : value
    );
  }
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  const compressed = gzipSync(bytes, { level: 9 });
  writeFileAtomicDurable(analysis, bytes);
  writeFileAtomicDurable(`${analysis}.gz`, compressed);
  writeFileAtomicDurable(
    `${analysis}.sha256`,
    `${sha256(bytes)}  ${relative(process.cwd(), analysis)}\n`,
  );
  writeFileAtomicDurable(
    `${analysis}.gz.sha256`,
    `${sha256(compressed)}  ${relative(process.cwd(), `${analysis}.gz`)}\n`,
  );
  console.log(`Migrated ${migrated} trace rows in ${relative(process.cwd(), analysis)}`);
}

function runKey(task: any): string {
  if (
    typeof task?.sourceId !== "string" || !Number.isFinite(task?.budget) ||
    !Number.isFinite(task?.actualSeed)
  ) throw new Error("scale row has incomplete task identity");
  return `${task.sourceId}\0${task.budget}\0${task.actualSeed}`;
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function requiredArgument(name: string): string {
  const value = argument(name);
  if (value === undefined || value === "") throw new Error(`requires --${name}=FILE`);
  return value;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

await main();
