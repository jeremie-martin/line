import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { RUN_ARCHIVE_SCHEMA } from "./runner.ts";
import { round } from "./util.ts";

const args = process.argv.slice(2);
const archiveArgument = args.find((arg) => !arg.startsWith("--"));
if (archiveArgument === undefined) throw new Error(`usage: benchmark explain <development-archive.json[.gz]>`);
const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};
const archivePath = resolve(archiveArgument);
const outputStem = resolve(argument("out") ?? archivePath.replace(/\.json(?:\.gz)?$/, ".explanation"));
const bytes = readFileSync(archivePath);
verifySidecar(archivePath, bytes);
const archiveBytes = archivePath.endsWith(".gz") ? gunzipSync(bytes) : bytes;
const archive = JSON.parse(archiveBytes.toString("utf8"));
if (archive.schema !== RUN_ARCHIVE_SCHEMA || archive.mode !== "development") {
  throw new Error(`explanation requires a Benchmark V2 development archive`);
}

const sourceStratum = new Map<string, string>();
for (const summary of archive.developmentSummaries) {
  for (const stratum of summary.strata) {
    for (const groupId of stratum.groups) {
      const group = summary.groups.find((entry: any) => entry.id === groupId);
      for (const sourceId of group?.members ?? []) sourceStratum.set(sourceId, stratum.id);
    }
  }
}

const budgets = archive.identity.budgets as number[];
const perBudget = budgets.map((budget) => {
  const rows = archive.runs.filter((row: any) => row.task.budget === budget);
  const valid = rows.filter((row: any) => row.score.valid);
  const invalid = rows.filter((row: any) => !row.score.valid);
  const axisTotals = new Map<string, { squaredError: number; observations: number }>();
  for (const row of valid) {
    for (const [axis, component] of Object.entries(row.score.components) as Array<[string, any]>) {
      const current = axisTotals.get(axis) ?? { squaredError: 0, observations: 0 };
      current.squaredError += component.rmsError ** 2 * component.observations;
      current.observations += component.observations;
      axisTotals.set(axis, current);
    }
  }
  const byStratum: Record<string, { valid: number; total: number }> = {};
  for (const row of rows) {
    const id = sourceStratum.get(row.task.sourceId) ?? "unknown";
    const current = byStratum[id] ??= { valid: 0, total: 0 };
    current.total++;
    if (row.score.valid) current.valid++;
  }
  return {
    budget,
    canonicalScore: archive.developmentSummaries.find((entry: any) => entry.budget === budget)?.score ?? null,
    validRuns: valid.length,
    totalRuns: rows.length,
    firstCompletions: rows.filter((row: any) => row.stats?.first_completion_frame != null).length,
    budgetExhausted: rows.filter((row: any) => row.stats?.budget_exhausted).length,
    meanInvalidContactProgress: invalid.length === 0 ? null : round(
      invalid.reduce((sum: number, row: any) =>
        sum + row.score.contacts.hit / Math.max(1, row.score.contacts.authored), 0) / invalid.length,
    ),
    invalidTermini: counts(invalid.map((row: any) => row.score.terminus.reason)),
    byStratum,
    pooledValidAxisRms: Object.fromEntries([...axisTotals].map(([axis, value]) => [axis, {
      rmsError: round(Math.sqrt(value.squaredError / value.observations)),
      observations: value.observations,
    }])),
  };
});

const perSource = [...new Set(archive.runs.map((row: any) => row.task.sourceId) as string[])].map((sourceId) => ({
  sourceId,
  stratum: sourceStratum.get(sourceId) ?? "unknown",
  budgets: budgets.map((budget) => {
    const rows = archive.runs.filter((row: any) => row.task.sourceId === sourceId && row.task.budget === budget);
    const valid = rows.filter((row: any) => row.score.valid);
    const summary = archive.developmentSummaries.find((entry: any) => entry.budget === budget)
      ?.specifications.find((entry: any) => entry.id === sourceId);
    return {
      budget,
      score: summary?.score ?? 0,
      validRuns: valid.length,
      totalRuns: rows.length,
      meanContactProgress: round(rows.reduce((sum: number, row: any) =>
        sum + row.score.contacts.hit / Math.max(1, row.score.contacts.authored), 0) / rows.length),
      dominantValidAxis: dominantAxis(valid),
    };
  }),
}));

const capabilityPhases = budgets.flatMap((budget) => {
  const rows = archive.runs.filter((row: any) => row.task.budget === budget && row.phaseResults.length > 0);
  const sourceIds = [...new Set(rows.map((row: any) => row.task.sourceId) as string[])];
  return sourceIds.flatMap((sourceId) => {
    const sourceRows = rows.filter((row: any) => row.task.sourceId === sourceId);
    const phaseIds = [...new Set(sourceRows.flatMap((row: any) => row.phaseResults.map((phase: any) => phase.id)) as string[])];
    return phaseIds.map((phaseId) => {
      const phases = sourceRows.map((row: any) => row.phaseResults.find((phase: any) => phase.id === phaseId));
      return {
        budget,
        sourceId,
        phaseId,
        completeRuns: phases.filter((phase: any) => phase.complete).length,
        totalRuns: phases.length,
        contactHitRate: round(phases.reduce((sum: number, phase: any) =>
          sum + phase.hitContacts, 0) / Math.max(1, phases.reduce((sum: number, phase: any) =>
          sum + phase.authoredContacts, 0))),
      };
    });
  });
});

const report = {
  schema: "line.benchmark-v2.explanation.v1",
  archive: archiveArgument,
  archiveSha256: createHash("sha256").update(bytes).digest("hex"),
  suiteFingerprint: archive.identity.suiteFingerprint,
  candidateFingerprint: archive.git.candidateFingerprint,
  canonicalHeadline: archive.canonicalHeadline,
  perBudget,
  perSource,
  capabilityPhases,
};
mkdirSync(dirname(outputStem), { recursive: true });
writeFileSync(`${outputStem}.json`, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(`${outputStem}.md`, markdown(report));
console.log(markdown(report));
console.log(`JSON: ${relative(`${outputStem}.json`)}`);
console.log(`Markdown: ${relative(`${outputStem}.md`)}`);

function dominantAxis(rows: any[]): { axis: string; rmsError: number } | null {
  const totals = new Map<string, { squaredError: number; observations: number }>();
  for (const row of rows) {
    for (const [axis, component] of Object.entries(row.score.components) as Array<[string, any]>) {
      const current = totals.get(axis) ?? { squaredError: 0, observations: 0 };
      current.squaredError += component.rmsError ** 2 * component.observations;
      current.observations += component.observations;
      totals.set(axis, current);
    }
  }
  const ranked = [...totals].map(([axis, value]) => ({
    axis,
    rmsError: round(Math.sqrt(value.squaredError / value.observations)),
  })).sort((a, b) => b.rmsError - a.rmsError || a.axis.localeCompare(b.axis));
  return ranked[0] ?? null;
}

function counts(values: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const value of values) out[value] = (out[value] ?? 0) + 1;
  return out;
}

function markdown(report: any): string {
  const lines = [
    "# Benchmark V2 Archive Explanation",
    "",
    `Canonical headline: **${report.canonicalHeadline.toFixed(2)}**.`,
    "",
    "| Budget | Score | Valid | First completion | Invalid progress | Pooled RMS |",
    "|---:|---:|---:|---:|---:|---|",
  ];
  for (const budget of report.perBudget) {
    const axes = Object.entries(budget.pooledValidAxisRms)
      .map(([axis, value]: [string, any]) => `${axis} ${value.rmsError.toFixed(3)}`).join(", ");
    lines.push(`| ${budget.budget / 1000}k | ${budget.canonicalScore.toFixed(2)} | ` +
      `${budget.validRuns}/${budget.totalRuns} | ${budget.firstCompletions}/${budget.totalRuns} | ` +
      `${budget.meanInvalidContactProgress === null ? "-" : `${(100 * budget.meanInvalidContactProgress).toFixed(1)}%`} | ${axes} |`);
  }
  lines.push("", "## Invalid sources by budget", "");
  for (const budget of report.perBudget) {
    const invalid = report.perSource.filter((source: any) =>
      source.budgets.find((entry: any) => entry.budget === budget.budget)?.validRuns <
      source.budgets.find((entry: any) => entry.budget === budget.budget)?.totalRuns
    ).map((source: any) => {
      const entry = source.budgets.find((item: any) => item.budget === budget.budget);
      return `${source.sourceId} ${entry.validRuns}/${entry.totalRuns}`;
    });
    lines.push(`- ${budget.budget / 1000}k: ${invalid.length === 0 ? "none" : invalid.join(", ")}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function verifySidecar(path: string, data: Buffer): void {
  const sidecar = `${path}.sha256`;
  if (!existsSync(sidecar)) throw new Error(`missing archive SHA-256 sidecar`);
  const expected = readFileSync(sidecar, "utf8").trim().split(/\s+/)[0];
  const actual = createHash("sha256").update(data).digest("hex");
  if (actual !== expected) throw new Error(`archive checksum mismatch`);
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
