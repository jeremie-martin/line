import type { AxisName } from "../types.ts";

export type ScreenRun = {
  sourceId: string;
  budget: number;
  seed: number;
  status: "ok" | "error";
  elapsedMs: number;
  score?: number;
  axisErrorRms?: number;
  contacts?: {
    authoredTotal: number;
    reportedTotal: number;
    hit: number;
    drift: number;
    reportedMissing: number;
    missingAuthored: number;
    offBeat: number;
  };
  terminus?: { frame: number; reason: string };
  lastHitContact?: { index: number; targetSeconds: number };
  firstMissingContact?: { index: number; targetSeconds: number };
  axisMeanAbsoluteError?: Partial<Record<AxisName, number>>;
  error?: string;
};

export type ScreenAggregate = {
  sourceId: string;
  budget: number;
  runs: number;
  errors: number;
  score: NumericAggregate;
  axisErrorRms: NumericAggregate;
  hitRate: NumericAggregate;
  missingContacts: NumericAggregate;
  offBeatLandings: NumericAggregate;
  elapsedMs: NumericAggregate;
  endOfSpecRate: NumericAggregate;
  axisMeanAbsoluteError: Partial<Record<AxisName, NumericAggregate>>;
};

export type NumericAggregate = {
  count: number;
  min: number | null;
  mean: number | null;
  max: number | null;
};

export function aggregateScreenRuns(runs: ScreenRun[]): ScreenAggregate[] {
  const groups = new Map<string, ScreenRun[]>();
  for (const run of runs) {
    const key = `${run.sourceId}\0${run.budget}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.values()]
    .map((group) => {
      const ok = group.filter((run) => run.status === "ok");
      return {
        sourceId: group[0].sourceId,
        budget: group[0].budget,
        runs: group.length,
        errors: group.length - ok.length,
        score: aggregate(ok.flatMap((run) => run.score === undefined ? [] : [run.score])),
        axisErrorRms: aggregate(ok.flatMap((run) => run.axisErrorRms === undefined ? [] : [run.axisErrorRms])),
        hitRate: aggregate(ok.flatMap((run) => run.contacts === undefined
          ? []
          : [run.contacts.authoredTotal === 0 ? 1 : run.contacts.hit / run.contacts.authoredTotal])),
        missingContacts: aggregate(ok.flatMap((run) => run.contacts === undefined ? [] : [run.contacts.missingAuthored])),
        offBeatLandings: aggregate(ok.flatMap((run) => run.contacts === undefined ? [] : [run.contacts.offBeat])),
        elapsedMs: aggregate(ok.map((run) => run.elapsedMs)),
        endOfSpecRate: aggregate(ok.map((run) => run.terminus?.reason === "endOfSpec" ? 1 : 0)),
        axisMeanAbsoluteError: Object.fromEntries(AXIS_NAMES.flatMap((axis) => {
          const values = ok.flatMap((run) => run.axisMeanAbsoluteError?.[axis] === undefined
            ? []
            : [run.axisMeanAbsoluteError[axis]!]);
          return values.length === 0 ? [] : [[axis, aggregate(values)]];
        })),
      };
    })
    .sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.budget - b.budget);
}

const AXIS_NAMES: AxisName[] = ["air", "speed", "elevation", "amplitude", "impact"];

export function renderScreenMarkdown(archive: {
  status: string;
  sourceRole: string;
  characterizationFingerprint: string;
  gitHead: string;
  worktreeTrackedDiffSha256: string;
  harnessFingerprint: string;
  compilerTrackedDiffSha256: string;
  engine: string;
  transform: { joltMs: number; effectiveContactShiftMs: number };
  budgets: number[];
  seeds: number[];
  aggregates: ScreenAggregate[];
  runs: ScreenRun[];
}): string {
  const lines = [
    `# Benchmark V2 ${titleCase(archive.sourceRole)} Screen`,
    "",
    `Status: ${archive.status}. This is not a Benchmark V2 score.`,
    "",
    `Characterization: \`${archive.characterizationFingerprint.slice(0, 16)}\`. Harness: \`${archive.harnessFingerprint.slice(0, 12)}\`.`,
    "",
    `Git HEAD: \`${archive.gitHead.slice(0, 12)}\`. Compiler diff: \`${archive.compilerTrackedDiffSha256.slice(0, 12)}\`. ` +
      `Whole tracked diff: \`${archive.worktreeTrackedDiffSha256.slice(0, 12)}\`.`,
    "",
    `Engine: ${archive.engine}. Production jolt parameter: ${archive.transform.joltMs}ms ` +
      `(effective contact shift ${archive.transform.effectiveContactShiftMs}ms).`,
    "",
    `Budgets: ${archive.budgets.join(", ")}. Seeds: ${archive.seeds.join(", ")}.`,
    "",
    "The score column uses the existing V1 `scoreDriftReport` only as a diagnostic. V2 aggregation and weights are not defined.",
    "",
    "| Source | Budget | Runs / errors | End-of-spec | Hit rate | Missing | Off-beat | Legacy score mean [min, max] | Axis RMS | Mean axis absolute error | Wall time |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|",
  ];
  for (const aggregate of archive.aggregates) {
    lines.push(
      `| ${aggregate.sourceId} | ${aggregate.budget} | ${aggregate.runs} / ${aggregate.errors} | ` +
      `${percent(aggregate.endOfSpecRate.mean)} | ${percent(aggregate.hitRate.mean)} | ` +
      `${number(aggregate.missingContacts.mean, 1)} | ${number(aggregate.offBeatLandings.mean, 1)} | ` +
      `${number(aggregate.score.mean, 2)} [${number(aggregate.score.min, 2)}, ${number(aggregate.score.max, 2)}] | ` +
      `${number(aggregate.axisErrorRms.mean, 4)} | ${formatAxisErrors(aggregate.axisMeanAbsoluteError)} | ` +
      `${number(aggregate.elapsedMs.mean === null ? null : aggregate.elapsedMs.mean / 1000, 2)}s |`,
    );
  }
  const failures = archive.runs.filter((run) => run.status === "ok" && run.terminus?.reason !== "endOfSpec");
  if (failures.length > 0) {
    lines.push(
      "",
      "## Failure frontiers",
      "",
      "Contact times include the declared production jolt transform.",
      "",
      "| Source | Budget | Seed | Terminus | Last hit | First missing |",
      "|---|---:|---:|---|---|---|",
    );
    for (const run of failures) {
      lines.push(
        `| ${run.sourceId} | ${run.budget} | ${run.seed} | ` +
        `${run.terminus?.reason}@${run.terminus?.frame} | ${formatContact(run.lastHitContact)} | ` +
        `${formatContact(run.firstMissingContact)} |`,
      );
    }
  }
  lines.push(
    "",
    `Heldout references were not compiled. The archive is suitable for ${archive.sourceRole} feasibility and variance decisions only.`,
    "",
  );
  return `${lines.join("\n")}\n`;
}

function formatContact(contact: ScreenRun["lastHitContact"]): string {
  return contact === undefined ? "-" : `#${contact.index} @ ${contact.targetSeconds.toFixed(3)}s`;
}

function titleCase(value: string): string {
  return value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
}

function formatAxisErrors(values: Partial<Record<AxisName, NumericAggregate>>): string {
  return AXIS_NAMES.flatMap((axis) => values[axis]?.mean === undefined
    ? []
    : [`${axis} ${number(values[axis]!.mean, 3)}`]).join(", ") || "-";
}

function percent(value: number | null): string {
  return value === null ? "-" : `${(value * 100).toFixed(1)}%`;
}

function number(value: number | null, digits: number): string {
  return value === null ? "-" : value.toFixed(digits);
}

function aggregate(values: number[]): NumericAggregate {
  if (values.length === 0) return { count: 0, min: null, mean: null, max: null };
  return {
    count: values.length,
    min: round(Math.min(...values)),
    mean: round(values.reduce((sum, value) => sum + value, 0) / values.length),
    max: round(Math.max(...values)),
  };
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
