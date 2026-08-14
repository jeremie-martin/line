/**
 * Run and read a disjoint confirmation block for one frozen canonical pair.
 *
 * The original sequential experiment is already closed, so its rows cannot be
 * silently pooled into a newly authoritative look. This instrument instead
 * runs both frozen compiler snapshots on a predeclared, disjoint seed block.
 * The fresh block owns the confirmation action; the combined depth is retained
 * as a descriptive reading only.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
} from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import {
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "../v0/benchmark_v2/compiler_snapshot.ts";
import {
  loadValidatedCanonicalStudyPair,
  loadVerifiedArchive,
  suiteAtDepth,
} from "../v0/benchmark_v2/decide.ts";
import {
  pairedV2Decision,
  studentTCdf,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";
import {
  referenceTDirectionalProbability,
  requireSequentialEvalCalibration,
  sequentialLookDecision,
} from "../v0/benchmark_v2/sequential_inference.ts";
import type { ResolvedSeedSchedule } from "../v0/benchmark_v2/suite_model.ts";

const DECLARATION_SCHEMA = "line.benchmark-v2.frozen-extension-confirmation.v1" as const;
const RESULT_SCHEMA = "line.benchmark-v2.frozen-extension-confirmation-result.v1" as const;
const DEFAULT_DECLARATION =
  "benchmark/v2/studies/aim-impact-residual-initial-only-n96-confirmation.json";

type ArmName = "baseline" | "candidate";

type Declaration = {
  schema: typeof DECLARATION_SCHEMA;
  status: string;
  candidate: {
    original_comparison: string;
    original_comparison_sha256: string;
    snapshot: CompilerSnapshot;
  };
  baseline: {
    reference: string;
    reference_sha256_at_declaration: string;
    snapshot: CompilerSnapshot;
  };
  canonicalSeedSchedule: ResolvedSeedSchedule;
  scope: {
    budget: number;
    prior_seed_blocks: number;
    fresh_seed_blocks: number;
    combined_seed_blocks: number;
    fresh_compiles_per_arm: number;
  };
  decision_rule: {
    boundary_constant: number;
    calibration: string;
    calibration_sha256: string;
  };
  prior_decision_indexes: {
    baseline: string[];
    candidate: string;
  };
  outputs: {
    baseline: string;
    candidate: string;
    result: string;
  };
};

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
for (const value of argv) {
  if (
    value !== "--resume" && value !== "--analyze" &&
    !/^--(declaration|arm|jobs)=.+$/.test(value)
  ) throw new Error(`unsupported frozen-extension option ${value}`);
}

const declarationPath = resolve(argument("declaration") ?? DEFAULT_DECLARATION);
const declaration = readDeclaration(declarationPath);
validateDeclaration(declaration, declarationPath);

if (argv.includes("--analyze")) {
  await analyze(declaration, declarationPath);
} else {
  const arm = parseArm(argument("arm"));
  const jobs = parseJobs(argument("jobs"));
  runArm(declaration, declarationPath, arm, jobs, argv.includes("--resume"));
}

function readDeclaration(path: string): Declaration {
  if (!existsSync(path)) throw new Error(`confirmation declaration is missing: ${path}`);
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (value?.schema !== DECLARATION_SCHEMA) {
    throw new Error(`unsupported confirmation declaration ${String(value?.schema)}`);
  }
  return value as Declaration;
}

function validateDeclaration(value: Declaration, path: string): void {
  if (value.status !== "predeclared_awaiting_fresh_runs") {
    throw new Error(`${path}: confirmation declaration is not in its pre-run state`);
  }
  validateCompilerSnapshot(value.baseline.snapshot);
  validateCompilerSnapshot(value.candidate.snapshot);
  if (
    value.baseline.snapshot.engineArtifactFingerprint !==
      value.candidate.snapshot.engineArtifactFingerprint
  ) throw new Error(`confirmation snapshots use different engine artifacts`);
  assertFileSha(value.baseline.reference, value.baseline.reference_sha256_at_declaration);
  assertFileSha(value.candidate.original_comparison, value.candidate.original_comparison_sha256);
  assertFileSha(value.decision_rule.calibration, value.decision_rule.calibration_sha256);

  const schedule = value.canonicalSeedSchedule;
  const freshSeeds = schedule.byBudget.flatMap((entry) => entry.actualSeeds);
  if (
    schedule.kind !== "profile_budget_disjoint_contiguous" ||
    schedule.profile !== "canonical" || schedule.seedsPerBudget !== value.scope.fresh_seed_blocks ||
    schedule.byBudget.length !== 1 || schedule.byBudget[0].budget !== value.scope.budget ||
    freshSeeds.length !== value.scope.fresh_seed_blocks ||
    new Set(freshSeeds).size !== freshSeeds.length
  ) throw new Error(`confirmation fresh seed schedule is malformed`);

  const comparison = JSON.parse(readFileSync(resolve(value.candidate.original_comparison), "utf8"));
  const requestBytes = readFileSync(resolve(comparison.request?.path ?? ""));
  if (sha256(requestBytes) !== comparison.request?.sha256) {
    throw new Error(`original comparison request checksum mismatch`);
  }
  const request = JSON.parse(requestBytes.toString("utf8"));
  const priorSeeds = request.canonicalSeedSchedule?.byBudget
    ?.flatMap((entry: { actualSeeds: number[] }) => entry.actualSeeds) ?? [];
  if (priorSeeds.length !== value.scope.prior_seed_blocks) {
    throw new Error(`original comparison does not contain the declared prior seed depth`);
  }
  if (freshSeeds.some((seed) => priorSeeds.includes(seed))) {
    throw new Error(`fresh confirmation seeds overlap the original experiment`);
  }
  if (
    JSON.stringify(comparison.candidate?.snapshot) !== JSON.stringify(value.candidate.snapshot)
  ) throw new Error(`declared candidate snapshot differs from the original comparison`);
  const baseline = JSON.parse(readFileSync(resolve(value.baseline.reference), "utf8"));
  if (JSON.stringify(baseline.compiler_snapshot) !== JSON.stringify(value.baseline.snapshot)) {
    throw new Error(`declared baseline snapshot differs from the active reference`);
  }
  if (
    value.scope.combined_seed_blocks !==
      value.scope.prior_seed_blocks + value.scope.fresh_seed_blocks
  ) throw new Error(`combined confirmation depth is not prior plus fresh depth`);
}

function runArm(
  value: Declaration,
  declarationFile: string,
  arm: ArmName,
  jobs: number,
  resume: boolean,
): void {
  const snapshot = value[arm].snapshot;
  const output = resolve(value.outputs[arm]);
  if (existsSync(output)) {
    assertArmArchive(loadVerifiedArchive(output).archive, value, arm);
    console.log(`${arm} confirmation arm is already complete: ${relativeToCwd(output)}`);
    return;
  }
  const checkpoint = `${output}.checkpoint.jsonl`;
  let workspace: ReturnType<typeof createSnapshotWorkspace> | undefined;
  try {
    workspace = createSnapshotWorkspace(snapshot);
    const run = runInWorkspace(workspace, "development", [
      "--profile=canonical",
      `--manifest=${resolve("benchmark/v2/compat/source-manifest.json")}`,
      `--heldout-manifest=${resolve("benchmark/v2/compat/heldout-manifest.json")}`,
      `--suite=${resolve("benchmark/v2/compat/suite-manifest.json")}`,
      `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
      `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
      `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
      `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
      `--jobs=${jobs}`,
      `--comparison-request=${declarationFile}`,
      `--canonical-seed-base=${value.canonicalSeedSchedule.seedBase}`,
      `--seeds-per-budget=${value.scope.fresh_seed_blocks}`,
      `--comparison-budgets=${value.scope.budget}`,
      `--seed-schedule=${declarationFile}`,
      `--checkpoint=${checkpoint}`,
      ...(resume || existsSync(checkpoint) ? ["--resume"] : []),
    ], output);
    if (run.workerFailures !== 0) throw new Error(`${arm} confirmation arm has worker failures`);
    assertArmArchive(loadVerifiedArchive(output).archive, value, arm);
    console.log(`${arm} confirmation arm complete: ${relativeToCwd(output)}`);
  } finally {
    if (workspace !== undefined) disposeSnapshotWorkspace(workspace);
  }
}

async function analyze(value: Declaration, declarationFile: string): Promise<void> {
  const baselinePath = resolve(value.outputs.baseline);
  const candidatePath = resolve(value.outputs.candidate);
  if (!existsSync(baselinePath) || !existsSync(candidatePath)) {
    throw new Error(`both frozen confirmation arms must complete before analysis`);
  }
  const pair = await loadValidatedCanonicalStudyPair(
    baselinePath,
    candidatePath,
    value.canonicalSeedSchedule,
  );
  const fresh = pairedV2Decision(
    pair.baseRuns,
    pair.candidateRuns,
    suiteAtDepth(pair.suite, value.scope.fresh_seed_blocks, [value.scope.budget]),
    { profile: "canonical", mode: "improvement" },
  );
  const baseline = loadVerifiedArchive(baselinePath);
  const candidate = loadVerifiedArchive(candidatePath);
  const calibration = requireSequentialEvalCalibration(
    baseline.archive.identity.suiteFingerprint,
  );
  if (calibration.boundaryConstant !== value.decision_rule.boundary_constant) {
    throw new Error(`declared confirmation boundary differs from retained calibration`);
  }
  const confirmation = sequentialLookDecision(
    fresh.confidence,
    value.scope.fresh_seed_blocks,
    calibration.boundaryConstant,
  );

  const priorBase = value.prior_decision_indexes.baseline.flatMap((path) =>
    decisionRuns(loadDecisionIndex(path).archive)
  );
  const priorCandidateIndex = loadDecisionIndex(value.prior_decision_indexes.candidate);
  const priorCandidate = decisionRuns(priorCandidateIndex.archive);
  if (
    priorCandidateIndex.archiveSha256 !==
      JSON.parse(readFileSync(resolve(value.candidate.original_comparison), "utf8"))
        .candidate.archiveSha256
  ) throw new Error(`prior candidate decision index differs from the original comparison`);
  const shift = value.scope.prior_seed_blocks;
  const combinedBase = [...priorBase, ...shiftRuns(pair.baseRuns, shift)];
  const combinedCandidate = [...priorCandidate, ...shiftRuns(pair.candidateRuns, shift)];
  const combined = pairedV2Decision(
    combinedBase,
    combinedCandidate,
    suiteAtDepth(pair.suite, value.scope.combined_seed_blocks, [value.scope.budget]),
    { profile: "canonical", mode: "improvement" },
  );
  const matchedValid = matchedValidSeedBlock(combinedBase, combinedCandidate);

  const result = {
    schema: RESULT_SCHEMA,
    generatedAt: new Date().toISOString(),
    authority: {
      primary: "fresh-independent-confirmation",
      combinedN96: "descriptive-only",
      declaration: relativeToCwd(declarationFile),
      declarationSha256: sha256(readFileSync(declarationFile)),
    },
    snapshots: {
      baseline: value.baseline.snapshot,
      candidate: value.candidate.snapshot,
    },
    fresh: {
      seedSchedule: value.canonicalSeedSchedule,
      baselineArchive: archiveReference(baseline),
      candidateArchive: archiveReference(candidate),
      decision: fresh,
      confirmation,
    },
    combinedN96: {
      authority: "descriptive-only-post-hoc-pooling",
      decision: combined,
      referenceDirectionalProbability: referenceTDirectionalProbability(combined.confidence),
      matchedValid,
    },
  };
  const output = resolve(value.outputs.result);
  const bytes = `${JSON.stringify(result, null, 2)}\n`;
  writeFileAtomicDurable(output, bytes);
  writeFileAtomicDurable(`${output}.sha256`, `${sha256(Buffer.from(bytes))}  ${relativeToCwd(output)}\n`);
  console.log(`Frozen extension confirmation: ${confirmation.action.toUpperCase()}`);
  console.log(
    `  fresh N48: ${fresh.baseHeadline.toFixed(2)} -> ${fresh.candidateHeadline.toFixed(2)} ` +
      `(delta ${signed(fresh.delta)}, SE ${fresh.confidence.standardError.toFixed(2)}, ` +
      `P+ ${(100 * confirmation.directionalProbability).toFixed(2)}%, ` +
      `need ${(100 * confirmation.requiredDirectionalProbability).toFixed(2)}%)`,
  );
  console.log(
    `  descriptive N96: delta ${signed(combined.delta)}, SE ${combined.confidence.standardError.toFixed(2)}, ` +
      `P+ ${(100 * referenceTDirectionalProbability(combined.confidence)).toFixed(2)}%`,
  );
  console.log(`  result: ${relativeToCwd(output)}`);
}

function loadDecisionIndex(path: string): { archive: any; archiveSha256: string } {
  const absolute = resolve(path);
  const bytes = readFileSync(absolute);
  const sidecar = readFileSync(`${absolute}.sha256`, "utf8").trim().split(/\s+/, 1)[0];
  if (sha256(bytes) !== sidecar) throw new Error(`${path}: decision-index checksum mismatch`);
  const index = JSON.parse(bytes.toString("utf8"));
  if (
    index?.schema !== "line.benchmark-v2.decision-index.v1" ||
    typeof index.archiveSha256 !== "string" ||
    index.payloadSha256 !== sha256(Buffer.from(JSON.stringify(index.archive)))
  ) throw new Error(`${path}: malformed or internally detached decision index`);
  return { archive: index.archive, archiveSha256: index.archiveSha256 };
}

function decisionRuns(archive: any): DecisionRun[] {
  return archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  }));
}

function shiftRuns(runs: DecisionRun[], shift: number): DecisionRun[] {
  return runs.map((run) => ({ ...run, seedSlot: run.seedSlot + shift }));
}

function matchedValidSeedBlock(base: DecisionRun[], candidate: DecisionRun[]): Record<string, unknown> {
  const byKey = new Map(base.map((run) => [runKey(run), run]));
  const bySeed = new Map<number, number[]>();
  let matched = 0;
  let gained = 0;
  let lost = 0;
  for (const run of candidate) {
    const reference = byKey.get(runKey(run));
    if (reference === undefined) throw new Error(`combined candidate has no baseline pair`);
    if (!reference.score.valid && run.score.valid) {
      gained++;
      continue;
    }
    if (reference.score.valid && !run.score.valid) {
      lost++;
      continue;
    }
    if (!reference.score.valid || !run.score.valid) continue;
    matched++;
    const values = bySeed.get(run.actualSeed) ?? [];
    values.push(run.score.score - reference.score.score);
    bySeed.set(run.actualSeed, values);
  }
  const blocks = [...bySeed.entries()].sort((a, b) => a[0] - b[0]).map(([seed, values]) => ({
    seed,
    cells: values.length,
    meanDelta: mean(values),
  }));
  const values = blocks.map((block) => block.meanDelta);
  const estimate = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - estimate) ** 2, 0) /
    (values.length - 1);
  const standardError = Math.sqrt(variance / values.length);
  const t = standardError === 0 ? Math.sign(estimate) * Infinity : estimate / standardError;
  return {
    matched,
    gained,
    lost,
    seedBlocks: values.length,
    estimate,
    standardError,
    degreesOfFreedom: values.length - 1,
    referenceDirectionalProbability: studentTCdf(t, values.length - 1),
  };
}

function assertArmArchive(archive: any, value: Declaration, arm: ArmName): void {
  if (
    archive?.mode !== "development" || archive.profile !== "canonical" ||
    archive.git?.candidateFingerprint !== value[arm].snapshot.candidateFingerprint ||
    JSON.stringify(archive.identity?.seedSchedule) !== JSON.stringify(value.canonicalSeedSchedule) ||
    archive.runs?.length !== value.scope.fresh_compiles_per_arm ||
    archive.runs.some((row: any) => row.status !== "ok")
  ) throw new Error(`${arm} confirmation archive does not match its frozen declaration`);
}

function archiveReference(value: ReturnType<typeof loadVerifiedArchive>): Record<string, unknown> {
  return {
    path: relativeToCwd(value.path),
    archiveSha256: value.archiveSha256,
    artifactSha256: value.artifactSha256,
  };
}

function runKey(run: DecisionRun): string {
  return `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function parseArm(value: string | undefined): ArmName {
  if (value === "baseline" || value === "candidate") return value;
  throw new Error(`frozen extension requires --arm=baseline|candidate or --analyze`);
}

function parseJobs(value: string | undefined): number {
  const jobs = Number(value ?? Math.min(48, availableParallelism()));
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) {
    throw new Error(`--jobs must be an integer in 1..48`);
  }
  return jobs;
}

function assertFileSha(path: string, expected: string): void {
  const actual = sha256(readFileSync(resolve(path)));
  if (actual !== expected) throw new Error(`${path}: checksum changed after declaration`);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function relativeToCwd(path: string): string {
  const absolute = resolve(path);
  const prefix = `${process.cwd()}/`;
  return absolute.startsWith(prefix) ? absolute.slice(prefix.length) : absolute;
}
