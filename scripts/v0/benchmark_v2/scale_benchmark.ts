import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { basename, dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  pairGridCells,
  readGridArm,
  type GridArm,
} from "../../benchmark/paired_grid.ts";
import {
  readVerifiedArtifact,
  verifyArtifactChecksum,
  verifyArtifactChecksumSync,
} from "../../benchmark/study_lib.ts";
import { pairedScaleMechanics } from "../../benchmark/analyze_scale_mechanics.ts";
import {
  createCompilerSnapshot,
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runScaleStudyInWorkspace,
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "./compiler_snapshot.ts";
import { writeFileAtomicDurable } from "./durable_fs.ts";
import { acquireRunLock } from "./runner.ts";
import {
  MULTI_BUDGET_COMPARISON_SCHEMA,
  pairedScaleComparison,
  scaleDepthCharacterization,
} from "./scale_decision.ts";
import {
  assertMultiBudgetExecutionScope,
  FROZEN_SCALE_STUDY_SCHEMA,
  loadMultiBudgetProfile,
  multiBudgetSeeds,
  type LoadedMultiBudgetProfile,
} from "./scale_profile.ts";
const SCALE_BASELINE_SCHEMA = "line.benchmark-v2.multi-budget-baseline.v3" as const;
const DEFAULT_PROFILE = "benchmark/v2/scale-profile.json";
export type BreadthPolicy =
  | "high-budget-three-quarter"
  | "repair-high-budget-three-quarter"
  | "repair-three-quarter"
  | "repair-seven-eighth"
  | "late-repair-seven-eighth"
  | "linear-cap-216";
export type RepairPolicy =
  | "protected-one-step-bridge"
  | "optimistic-axis-bound-bridge";
export type RepairSelectionPolicy =
  | "reserve-cheapest-repair"
  | "reserve-cheapest-else-deepest"
  | "worst-target-runway-per-cost";

export type MultiBudgetBaseline = {
  schema: typeof SCALE_BASELINE_SCHEMA;
  generatedAt: string;
  label: string;
  profile: {
    id: string;
    path: string;
    fingerprint: string;
  };
  scope: {
    sources: string[];
    budgets: number[];
    seeds: number[];
    maximumSeeds: number;
  };
  compilerSnapshot: CompilerSnapshot;
  archive: {
    path: string;
    sha256: string;
    compressedSha256: string;
    scaleHeadline: number;
  };
};

export async function runScaleBenchmarkCommand(argv = process.argv.slice(2)): Promise<number> {
  const action = scaleAction(argv);
  const args = argv.filter((arg) => arg !== action);
  assertScaleArguments(action, args);
  if (action === "baseline") return runScaleBaseline(args);
  if (action === "eval") return runScaleEval(args);
  return runScaleCompare(args);
}

/** Validate before catalog preparation or compiler snapshotting does work. */
export function assertScaleCommandArguments(argv: string[]): void {
  const action = scaleAction(argv);
  assertScaleArguments(action, argv.filter((arg) => arg !== action));
}

export function assertScaleArguments(
  action: "baseline" | "eval" | "compare",
  argv: string[],
): void {
  const booleans = new Set(action === "compare" ? ["json"] : ["resume", "json"]);
  const values = new Set(action === "baseline"
    ? ["seeds", "out", "jobs", "budget-telemetry", "label", "extend-from"]
    : action === "eval"
      ? [
        "baseline",
        "seeds",
        "out",
        "artifact",
        "jobs",
        "budget-telemetry",
        "extend-from",
        "extend-snapshot",
        "breadth-policy",
        "repair-policy",
        "repair-selection-policy",
        "aim-impact-power",
        "aim-topk-exponent",
        "aim-topk-scope",
        "aim-topk-first-repair-extra",
      ]
      : ["baseline", "candidate", "artifact"]);
  for (const arg of argv) {
    if (!arg.startsWith("--")) throw new Error(`scale ${action} does not accept ${arg}`);
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 && booleans.has(name)) continue;
    if (equals !== -1 && values.has(name) && arg.slice(equals + 1) !== "") {
      if (name === "breadth-policy") parseBreadthPolicy(arg.slice(equals + 1));
      if (name === "repair-policy") parseRepairPolicy(arg.slice(equals + 1));
      if (name === "repair-selection-policy") {
        parseRepairSelectionPolicy(arg.slice(equals + 1));
      }
      if (name === "aim-impact-power") parseAimImpactPower(arg.slice(equals + 1));
      if (name === "aim-topk-exponent") parseAimTopKExponent(arg.slice(equals + 1));
      if (name === "aim-topk-scope") parseAimTopKScope(arg.slice(equals + 1));
      if (name === "aim-topk-first-repair-extra") {
        parseAimTopKFirstRepairExtra(arg.slice(equals + 1));
      }
      continue;
    }
    throw new Error(`scale ${action} does not accept ${arg}`);
  }
  if (
    action === "eval" && argumentIn(argv)("aim-topk-scope") !== undefined &&
    argumentIn(argv)("aim-topk-exponent") === undefined
  ) {
    throw new Error(`--aim-topk-scope requires --aim-topk-exponent`);
  }
}

async function runScaleBaseline(argv: string[]): Promise<number> {
  requireWasm();
  const argument = argumentIn(argv);
  const profile = loadMultiBudgetProfile(DEFAULT_PROFILE);
  const depth = parseDepth(argument("seeds"), profile, profile.profile.seedSchedule.maximumSeeds);
  const jobs = parseJobs(argument("jobs"));
  const telemetry = parseTelemetry(argument("budget-telemetry"));
  const label = argument("label") ?? `scale-${profile.profile.id}`;
  const manifestPath = resolve(argument("out") ??
    `generated/benchmark-v2/scale/${timestamp()}-baseline.json`);
  const archivePath = siblingPath(manifestPath, ".archive.json");
  const snapshotPath = siblingPath(manifestPath, ".snapshot.json");
  const resuming = argv.includes("--resume");
  const extensionBaselinePath = argument("extend-from") === undefined
    ? null
    : resolve(argument("extend-from")!);
  if (resuming && extensionBaselinePath !== null) {
    throw new Error(`scale baseline cannot combine --resume and --extend-from`);
  }
  const checkpointPath = `${archivePath}.checkpoint.jsonl`;
  if (resuming && existsSync(checkpointPath) && !existsSync(snapshotPath)) {
    throw new Error(
      `scale baseline checkpoint ${relativeToCwd(checkpointPath)} has no frozen snapshot sidecar; ` +
        `its compiler provenance cannot be reconstructed safely`,
    );
  }
  const extensionBaseline = extensionBaselinePath === null
    ? null
    : readScaleBaseline(extensionBaselinePath);
  const extension = extensionBaseline === null
    ? null
    : validateScaleBaselineExtension(extensionBaseline, profile, depth);
  const snapshot = extensionBaseline !== null
    ? extensionBaseline.compilerSnapshot
    : resuming && existsSync(snapshotPath)
      ? readCompilerSnapshot(snapshotPath)
      : createCompilerSnapshot(
        `${basename(manifestPath, ".json")}-baseline`,
        dirname(manifestPath),
      );
  if (!existsSync(snapshotPath)) writeJsonArtifact(snapshotPath, snapshot);
  const release = acquireRunLock(archivePath);
  let workspace: ReturnType<typeof createSnapshotWorkspace> | null = null;
  try {
    workspace = createSnapshotWorkspace(snapshot);
    const run = runScaleStudyInWorkspace(
      workspace,
      scaleRunnerArgs(
        workspace.directory,
        profile,
        depth,
        jobs,
        telemetry,
        resuming,
        archivePath,
        extension,
        null,
      ),
      archivePath,
    );
    if (run.workerFailures > 0) {
      throw new Error(`${run.workerFailures} scale baseline worker failure(s); archive and checkpoint retained`);
    }
    const manifest: MultiBudgetBaseline = {
      schema: SCALE_BASELINE_SCHEMA,
      generatedAt: new Date().toISOString(),
      label,
      profile: {
        id: profile.profile.id,
        path: relativeToCwd(profile.path),
        fingerprint: profile.fingerprint,
      },
      scope: {
        sources: profile.profile.sources.map((source) => source.id),
        budgets: profile.profile.budgets.map((budget) => budget.frames),
        seeds: multiBudgetSeeds(profile.profile, depth),
        maximumSeeds: depth,
      },
      compilerSnapshot: snapshot,
      archive: {
        path: relativeToCwd(run.outputPath),
        sha256: run.archiveSha256,
        compressedSha256: run.compressedArchiveSha256,
        scaleHeadline: run.scaleHeadline,
      },
    };
    writeJsonArtifact(manifestPath, manifest);
    emit(argv, {
      schema: SCALE_BASELINE_SCHEMA,
      status: "complete",
      baseline: relativeToCwd(manifestPath),
      archive: manifest.archive.path,
      scaleHeadline: manifest.archive.scaleHeadline,
      seeds: depth,
      cells: profile.profile.sources.length * profile.profile.budgets.length * depth,
      nextCommand: `npm run benchmark -- scale eval --baseline=${relativeToCwd(manifestPath)} --seeds=${profile.profile.seedSchedule.defaultSeeds}`,
    });
    return 0;
  } finally {
    if (workspace !== null) disposeSnapshotWorkspace(workspace);
    release();
  }
}

function validateScaleBaselineExtension(
  baseline: MultiBudgetBaseline,
  profile: LoadedMultiBudgetProfile,
  targetDepth: number,
): { checkpointPath: string; seeds: number[] } {
  assertBaselineProfile(baseline, profile);
  const sourceDepth = baseline.scope.maximumSeeds;
  if (sourceDepth >= targetDepth) {
    throw new Error(`--extend-from must be a smaller declared scale look than --seeds=${targetDepth}`);
  }
  const checkpointPath = resolve(`${baseline.archive.path}.checkpoint.jsonl`);
  if (!existsSync(checkpointPath)) {
    throw new Error(`--extend-from requires its retained checkpoint ${checkpointPath}`);
  }
  return { checkpointPath, seeds: baseline.scope.seeds };
}

function readCompilerSnapshot(path: string): CompilerSnapshot {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as CompilerSnapshot;
  validateCompilerSnapshot(parsed);
  return parsed;
}

async function runScaleEval(argv: string[]): Promise<number> {
  requireWasm();
  const argument = argumentIn(argv);
  const baselinePath = requiredPath(argument("baseline"), "scale eval requires --baseline=FILE");
  const baseline = readScaleBaseline(baselinePath);
  const profile = loadMultiBudgetProfile(DEFAULT_PROFILE);
  assertBaselineProfile(baseline, profile);
  const depth = parseDepth(argument("seeds"), profile, profile.profile.seedSchedule.defaultSeeds);
  if (depth > baseline.scope.maximumSeeds) {
    throw new Error(`candidate depth ${depth} exceeds baseline depth ${baseline.scope.maximumSeeds}`);
  }
  const jobs = parseJobs(argument("jobs"));
  const telemetry = parseTelemetry(argument("budget-telemetry"));
  const breadthPolicy = scaleBreadthPolicyArgument(argv);
  const repairPolicy = scaleRepairPolicyArgument(argv);
  const repairSelectionPolicy = scaleRepairSelectionPolicyArgument(argv);
  const aimImpactPower = scaleAimImpactPowerArgument(argv);
  const aimTopKExponent = scaleAimTopKExponentArgument(argv);
  const aimTopKScope = scaleAimTopKScopeArgument(argv);
  const aimTopKFirstRepairExtra = scaleAimTopKFirstRepairExtraArgument(argv);
  if (aimTopKScope !== null && aimTopKExponent === null) {
    throw new Error(`--aim-topk-scope requires --aim-topk-exponent`);
  }
  const extensionPath = argument("extend-from") === undefined
    ? null
    : resolve(argument("extend-from")!);
  const extensionSnapshotPath = argument("extend-snapshot") === undefined
    ? null
    : resolve(argument("extend-snapshot")!);
  if (extensionPath === null && extensionSnapshotPath !== null) {
    throw new Error(`--extend-snapshot requires --extend-from`);
  }
  const candidatePath = resolve(argument("out") ??
    `generated/benchmark-v2/scale/${timestamp()}-candidate.json`);
  if (extensionPath === candidatePath) {
    throw new Error(`--extend-from and --out must name different archives`);
  }
  const artifactPath = resolve(argument("artifact") ?? siblingPath(candidatePath, ".comparison.json"));
  const snapshot = extensionPath === null
    ? createCompilerSnapshot(`${basename(candidatePath, ".json")}-candidate`, dirname(candidatePath))
    : await readScaleExtensionSnapshot(
      extensionPath,
      extensionSnapshotPath ?? siblingPath(extensionPath, ".comparison.json"),
    );
  const extension = extensionPath === null
    ? null
    : validateScaleExtension(
      extensionPath,
      profile,
      depth,
      snapshot,
      breadthPolicy,
      repairPolicy,
      repairSelectionPolicy,
      aimImpactPower,
      aimTopKExponent,
      aimTopKScope,
      aimTopKFirstRepairExtra,
    );
  const release = acquireRunLock(candidatePath);
  let workspace: ReturnType<typeof createSnapshotWorkspace> | null = null;
  try {
    workspace = createSnapshotWorkspace(snapshot);
    const run = runScaleStudyInWorkspace(
      workspace,
      scaleRunnerArgs(
        workspace.directory,
        profile,
        depth,
        jobs,
        telemetry,
        argv.includes("--resume"),
        candidatePath,
        extension,
        breadthPolicy,
        repairPolicy,
        repairSelectionPolicy,
        aimImpactPower,
        aimTopKExponent,
        aimTopKScope,
        aimTopKFirstRepairExtra,
      ),
      candidatePath,
    );
    if (run.workerFailures > 0) {
      throw new Error(`${run.workerFailures} scale candidate worker failure(s); archive and checkpoint retained`);
    }
    const artifact = await compareScaleArchives(
      baseline,
      baselinePath,
      candidatePath,
      profile,
      depth,
      snapshot,
      artifactPath,
    );
    writeJsonArtifact(artifactPath, artifact);
    emitComparison(argv, artifactPath, artifact);
    return 0;
  } finally {
    if (workspace !== null) disposeSnapshotWorkspace(workspace);
    release();
  }
}

async function runScaleCompare(argv: string[]): Promise<number> {
  const argument = argumentIn(argv);
  const baselinePath = requiredPath(argument("baseline"), "scale compare requires --baseline=FILE");
  const candidatePath = requiredPath(argument("candidate"), "scale compare requires --candidate=FILE");
  const artifactPath = resolve(argument("artifact") ?? siblingPath(candidatePath, ".comparison.json"));
  const baseline = readScaleBaseline(baselinePath);
  const profile = loadMultiBudgetProfile(DEFAULT_PROFILE);
  assertBaselineProfile(baseline, profile);
  const candidateArchive = readGridArm("candidate", scaleAnalysisPath(candidatePath)).archive;
  const depth = Array.isArray(candidateArchive.seeds) ? candidateArchive.seeds.length : 0;
  const artifact = await compareScaleArchives(
    baseline,
    baselinePath,
    candidatePath,
    profile,
    depth,
    null,
    null,
  );
  writeJsonArtifact(artifactPath, artifact);
  emitComparison(argv, artifactPath, artifact);
  return 0;
}

async function compareScaleArchives(
  baseline: MultiBudgetBaseline,
  baselinePath: string,
  candidatePath: string,
  profile: LoadedMultiBudgetProfile,
  depth: number,
  snapshot: CompilerSnapshot | null,
  extensionSnapshotPath: string | null,
): Promise<Record<string, unknown>> {
  const expectedSeeds = multiBudgetSeeds(profile.profile, depth);
  const reference = readGridArm("reference", scaleAnalysisPath(baseline.archive.path));
  const candidateReadPath = scaleAnalysisPath(candidatePath);
  const candidate = readGridArm("candidate", candidateReadPath);
  assertArchiveProfile(reference.archive, profile);
  assertArchiveProfile(candidate.archive, profile);
  assertMultiBudgetExecutionScope(profile.profile, reference.archive.budgets, reference.archive.seeds);
  assertMultiBudgetExecutionScope(profile.profile, candidate.archive.budgets, candidate.archive.seeds);
  if (JSON.stringify(candidate.archive.seeds) !== JSON.stringify(expectedSeeds)) {
    throw new Error(`candidate archive does not contain the declared seed prefix`);
  }
  const referencePrefix = restrictArm(reference, new Set(candidate.cells.keys()));
  const comparabilityNotes = assertPairedArms(candidate, referencePrefix);
  if (candidate.archive.nCandPolicy !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: candidate breadth policy ${candidate.archive.nCandPolicy}; ` +
        `the production reference has no breadth-policy override`,
    );
  }
  if (candidate.archive.repairPolicy !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: candidate repair policy ${candidate.archive.repairPolicy}; ` +
        `the production reference has no repair-policy override`,
    );
  }
  if (candidate.archive.repairSelectionPolicy !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: candidate repair selection policy ` +
        `${candidate.archive.repairSelectionPolicy}; the production reference has no ` +
        `repair-selection-policy override`,
    );
  }
  if (candidate.archive.aimImpactPower !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: candidate aim impact power ` +
        `${candidate.archive.aimImpactPower}; the production reference uses 1`,
    );
  }
  if (candidate.archive.aimTopKExponent !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: candidate aim top-K exponent ` +
        `${candidate.archive.aimTopKExponent} in ` +
        `${candidate.archive.aimTopKScope ?? "all"} scope; the production reference uses 1`,
    );
  }
  if (candidate.archive.aimTopKFirstRepairExtra !== undefined) {
    comparabilityNotes.push(
      `declared study intervention: ${candidate.archive.aimTopKFirstRepairExtra} additional ` +
        `aim base(s) only in repair iteration zero; the production reference uses 0`,
    );
  }
  const paired = pairGridCells(candidate, referencePrefix);
  const result = pairedScaleComparison(paired.pairs, profile.profile, depth);
  const requestedDepthCharacterization = scaleDepthCharacterization(
    paired.pairs,
    profile.profile,
    depth,
  );
  const candidateKeys = new Set(candidate.cells.keys());
  const mechanics = pairedScaleMechanics(
    reference.archive.runs.filter((row: any) => candidateKeys.has(
      gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    )),
    candidate.archive.runs,
  );
  const candidateSha256 = await verifyArtifactChecksum(resolve(candidatePath));
  if (candidateReadPath !== candidatePath) {
    const projection = candidate.archive.analysisProjection;
    if (projection?.schema !== "line.benchmark-v2.scale-analysis-projection.v1" ||
        projection.fullArchiveSha256 !== candidateSha256) {
      throw new Error(`candidate scale analysis projection does not match its full archive`);
    }
  }
  return {
    schema: MULTI_BUDGET_COMPARISON_SCHEMA,
    generatedAt: new Date().toISOString(),
    status: "complete",
    authority: profile.profile.decision.authority,
    profile: {
      id: profile.profile.id,
      fingerprint: profile.fingerprint,
      sources: profile.profile.sources,
      budgets: profile.profile.budgets,
    },
    decision: {
      policy: profile.profile.decision,
      implementationFingerprint: sha256(readFileSync(
        resolve("scripts/v0/benchmark_v2/scale_decision.ts"),
      )),
    },
    baseline: {
      manifestPath: relativeToCwd(baselinePath),
      label: baseline.label,
      archivePath: baseline.archive.path,
      archiveSha256: baseline.archive.sha256,
      compilerSnapshot: baseline.compilerSnapshot,
    },
    candidate: {
      archivePath: relativeToCwd(candidatePath),
      archiveSha256: candidateSha256,
      compilerSnapshot: snapshot,
      identity: candidate.archive.candidate,
      intervention: candidate.archive.nCandPolicy !== undefined
        ? { kind: "candidate-breadth-policy", policy: candidate.archive.nCandPolicy }
        : candidate.archive.repairPolicy !== undefined
          ? { kind: "candidate-repair-policy", policy: candidate.archive.repairPolicy }
          : candidate.archive.repairSelectionPolicy !== undefined
            ? {
              kind: "candidate-repair-selection-policy",
              policy: candidate.archive.repairSelectionPolicy,
            }
            : candidate.archive.aimImpactPower !== undefined
              ? { kind: "candidate-aim-impact-power", power: candidate.archive.aimImpactPower }
              : candidate.archive.aimTopKExponent !== undefined
                ? {
                  kind: "candidate-aim-topk-exponent",
                  exponent: candidate.archive.aimTopKExponent,
                  scope: candidate.archive.aimTopKScope ?? "all",
                }
                : candidate.archive.aimTopKFirstRepairExtra !== undefined
                  ? {
                    kind: "candidate-aim-topk-first-repair-extra",
                    extra: candidate.archive.aimTopKFirstRepairExtra,
                  }
                : null,
    },
    comparabilityNotes,
    result,
    requestedDepthCharacterization,
    mechanics,
    nextCommand: result.nextLook === null || snapshot === null || extensionSnapshotPath === null
      ? null
      : `npm run benchmark -- scale eval --baseline=${relativeToCwd(baselinePath)} ` +
        `--seeds=${result.nextLook} --extend-from=${relativeToCwd(candidatePath)} ` +
        `--extend-snapshot=${relativeToCwd(extensionSnapshotPath)}` +
        (candidate.archive.nCandPolicy === undefined
          ? ""
          : ` --breadth-policy=${candidate.archive.nCandPolicy}`) +
        (candidate.archive.repairPolicy === undefined
          ? ""
          : ` --repair-policy=${candidate.archive.repairPolicy}`) +
        (candidate.archive.repairSelectionPolicy === undefined
          ? ""
          : ` --repair-selection-policy=${candidate.archive.repairSelectionPolicy}`) +
        (candidate.archive.aimImpactPower === undefined
          ? ""
          : ` --aim-impact-power=${candidate.archive.aimImpactPower}`) +
        (candidate.archive.aimTopKExponent === undefined
          ? ""
          : ` --aim-topk-exponent=${candidate.archive.aimTopKExponent}`) +
        (candidate.archive.aimTopKScope === undefined
          ? ""
          : ` --aim-topk-scope=${candidate.archive.aimTopKScope}`) +
        (candidate.archive.aimTopKFirstRepairExtra === undefined
          ? ""
          : ` --aim-topk-first-repair-extra=${candidate.archive.aimTopKFirstRepairExtra}`),
  };
}

function scaleRunnerArgs(
  workspace: string,
  profile: LoadedMultiBudgetProfile,
  depth: number,
  jobs: number,
  telemetry: "off" | "summary" | "trace",
  resume: boolean,
  outputPath: string,
  extension: { checkpointPath: string; seeds: number[] } | null = null,
  breadthPolicy: BreadthPolicy | null = null,
  repairPolicy: RepairPolicy | null = null,
  repairSelectionPolicy: RepairSelectionPolicy | null = null,
  aimImpactPower: number | null = null,
  aimTopKExponent: number | null = null,
  aimTopKScope: "repair" | null = null,
  aimTopKFirstRepairExtra: number | null = null,
): string[] {
  const profilePath = resolve(workspace, "benchmark/v2/scale-profile.json");
  return [
    `--scale-profile=${profilePath}`,
    `--budgets=${profile.profile.budgets.map((budget) => budget.frames).join(",")}`,
    `--seeds=${multiBudgetSeeds(profile.profile, depth).join(",")}`,
    `--jobs=${jobs}`,
    `--budget-telemetry=${telemetry}`,
    `--checkpoint=${resolve(`${outputPath}.checkpoint.jsonl`)}`,
    ...(breadthPolicy === null ? [] : [`--ncand-policy=${breadthPolicy}`]),
    ...(repairPolicy === null ? [] : [`--repair-policy=${repairPolicy}`]),
    ...(repairSelectionPolicy === null
      ? []
      : [`--repair-selection-policy=${repairSelectionPolicy}`]),
    ...(aimImpactPower === null ? [] : [`--aim-impact-power=${aimImpactPower}`]),
    ...(aimTopKExponent === null ? [] : [`--aim-topk-exponent=${aimTopKExponent}`]),
    ...(aimTopKScope === null ? [] : [`--aim-topk-scope=${aimTopKScope}`]),
    ...(aimTopKFirstRepairExtra === null
      ? []
      : [`--aim-topk-first-repair-extra=${aimTopKFirstRepairExtra}`]),
    ...(extension === null ? [] : [
      `--import-checkpoint=${extension.checkpointPath}`,
      `--import-budgets=${profile.profile.budgets.map((budget) => budget.frames).join(",")}`,
      `--import-seeds=${extension.seeds.join(",")}`,
    ]),
    ...(resume ? ["--resume"] : []),
  ];
}

function validateScaleExtension(
  path: string,
  profile: LoadedMultiBudgetProfile,
  targetDepth: number,
  snapshot: CompilerSnapshot,
  breadthPolicy: BreadthPolicy | null,
  repairPolicy: RepairPolicy | null,
  repairSelectionPolicy: RepairSelectionPolicy | null,
  aimImpactPower: number | null,
  aimTopKExponent: number | null,
  aimTopKScope: "repair" | null,
  aimTopKFirstRepairExtra: number | null,
): { checkpointPath: string; seeds: number[] } {
  const arm = readGridArm("candidate-prefix", scaleAnalysisPath(path));
  assertArchiveProfile(arm.archive, profile);
  assertMultiBudgetExecutionScope(profile.profile, arm.archive.budgets, arm.archive.seeds);
  const sourceDepth = arm.archive.seeds.length;
  if (!profile.profile.seedSchedule.looks.includes(sourceDepth) || sourceDepth >= targetDepth) {
    throw new Error(`--extend-from must be a smaller declared scale look than --seeds=${targetDepth}`);
  }
  if (arm.archive.candidate?.candidateFingerprint !== snapshot.candidateFingerprint) {
    throw new Error(`--extend-from was compiled by a different candidate`);
  }
  if ((arm.archive.nCandPolicy ?? null) !== breadthPolicy) {
    throw new Error(`--extend-from used a different candidate breadth policy`);
  }
  if ((arm.archive.repairPolicy ?? null) !== repairPolicy) {
    throw new Error(`--extend-from used a different candidate repair policy`);
  }
  if ((arm.archive.repairSelectionPolicy ?? null) !== repairSelectionPolicy) {
    throw new Error(`--extend-from used a different candidate repair selection policy`);
  }
  if ((arm.archive.aimImpactPower ?? null) !== aimImpactPower) {
    throw new Error(`--extend-from used a different candidate aim impact power`);
  }
  if ((arm.archive.aimTopKExponent ?? null) !== aimTopKExponent) {
    throw new Error(`--extend-from used a different candidate aim top-K exponent`);
  }
  if ((arm.archive.aimTopKScope ?? null) !== aimTopKScope) {
    throw new Error(`--extend-from used a different candidate aim top-K scope`);
  }
  if ((arm.archive.aimTopKFirstRepairExtra ?? null) !== aimTopKFirstRepairExtra) {
    throw new Error(`--extend-from used a different first-repair aim top-K increment`);
  }
  const checkpointPath = resolve(`${path}.checkpoint.jsonl`);
  if (!existsSync(checkpointPath)) {
    throw new Error(`--extend-from requires its retained checkpoint ${checkpointPath}`);
  }
  return { checkpointPath, seeds: arm.archive.seeds };
}

async function readScaleExtensionSnapshot(
  candidatePath: string,
  comparisonPath: string,
): Promise<CompilerSnapshot> {
  if (!existsSync(comparisonPath)) {
    throw new Error(
      `--extend-from requires its frozen compiler snapshot comparison ${comparisonPath}; ` +
        `pass a nonstandard location with --extend-snapshot=FILE`,
    );
  }
  const verified = readVerifiedArtifact(comparisonPath);
  const comparison = JSON.parse(verified.bytes.toString("utf8"));
  if (
    comparison?.schema !== MULTI_BUDGET_COMPARISON_SCHEMA ||
    resolve(comparison.candidate?.archivePath ?? "") !== resolve(candidatePath) ||
    typeof comparison.candidate?.archiveSha256 !== "string" ||
    comparison.candidate?.compilerSnapshot?.schema !== "line.benchmark-v2.compiler-snapshot.v1"
  ) {
    throw new Error(`${comparisonPath} does not describe the candidate being extended`);
  }
  const candidateSha256 = await verifyArtifactChecksum(resolve(candidatePath));
  if (candidateSha256 !== comparison.candidate.archiveSha256) {
    throw new Error(`${comparisonPath} candidate checksum does not match --extend-from`);
  }
  const snapshot = comparison.candidate.compilerSnapshot as CompilerSnapshot;
  validateCompilerSnapshot(snapshot);
  return snapshot;
}

function readScaleBaseline(path: string): MultiBudgetBaseline {
  const verified = readVerifiedArtifact(resolve(path));
  const baseline = JSON.parse(verified.bytes.toString("utf8")) as MultiBudgetBaseline;
  if (
    baseline?.schema !== SCALE_BASELINE_SCHEMA || typeof baseline.label !== "string" ||
    !Array.isArray(baseline.scope?.sources) || !Array.isArray(baseline.scope?.budgets) ||
    !Array.isArray(baseline.scope?.seeds) || !Number.isSafeInteger(baseline.scope?.maximumSeeds) ||
    typeof baseline.archive?.path !== "string" || typeof baseline.archive?.sha256 !== "string" ||
    baseline.compilerSnapshot?.schema !== "line.benchmark-v2.compiler-snapshot.v1"
  ) throw new Error(`${path}: unsupported or incomplete multi-budget baseline`);
  validateCompilerSnapshot(baseline.compilerSnapshot);
  const archivePath = resolve(baseline.archive.path);
  const archiveSha256 = verifyArtifactChecksumSync(archivePath);
  if (archiveSha256 !== baseline.archive.sha256) {
    throw new Error(`${path}: baseline archive checksum does not match its manifest`);
  }
  const projectionPath = scaleAnalysisPath(archivePath);
  if (projectionPath === archivePath) {
    throw new Error(`${path}: baseline archive requires its checksummed analysis projection`);
  }
  const projection = readVerifiedArtifact(projectionPath);
  const archiveValue = JSON.parse(projection.bytes.toString("utf8"));
  if (
    archiveValue.analysisProjection?.schema !==
      "line.benchmark-v2.scale-analysis-projection.v1" ||
    archiveValue.analysisProjection?.fullArchiveSha256 !== archiveSha256 ||
    JSON.stringify(archiveValue.budgets) !== JSON.stringify(baseline.scope.budgets) ||
    JSON.stringify(archiveValue.seeds) !== JSON.stringify(baseline.scope.seeds)
  ) throw new Error(`${path}: baseline manifest and archive disagree on scope or repair policy`);
  return baseline;
}

function assertBaselineProfile(
  baseline: MultiBudgetBaseline,
  profile: LoadedMultiBudgetProfile,
): void {
  if (
    baseline.profile.id !== profile.profile.id || baseline.profile.fingerprint !== profile.fingerprint ||
    JSON.stringify(baseline.scope.sources) !== JSON.stringify(profile.profile.sources.map((source) => source.id)) ||
    JSON.stringify(baseline.scope.budgets) !== JSON.stringify(profile.profile.budgets.map((budget) => budget.frames)) ||
    !profile.profile.seedSchedule.looks.includes(baseline.scope.maximumSeeds) ||
    JSON.stringify(baseline.scope.seeds) !==
      JSON.stringify(multiBudgetSeeds(profile.profile, baseline.scope.maximumSeeds))
  ) throw new Error(`multi-budget baseline does not match the current frozen scale profile`);
}

function assertArchiveProfile(archive: any, profile: LoadedMultiBudgetProfile): void {
  if (
    archive?.schema !== FROZEN_SCALE_STUDY_SCHEMA ||
    archive.scaleProfile?.fingerprint !== profile.fingerprint ||
    archive.scaleProfile?.definition?.id !== profile.profile.id
  ) throw new Error(`scale archive does not match the current frozen multi-budget profile`);
}

function restrictArm(arm: GridArm, keys: Set<string>): GridArm {
  return {
    ...arm,
    cells: new Map([...arm.cells].filter(([key]) => keys.has(key))),
  };
}

function parseDepth(
  raw: string | undefined,
  profile: LoadedMultiBudgetProfile,
  fallback: number,
): number {
  const depth = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(depth) || !profile.profile.seedSchedule.looks.includes(depth)) {
    throw new Error(`--seeds must be a declared scale look: ${profile.profile.seedSchedule.looks.join(",")}`);
  }
  return depth;
}

function parseJobs(raw: string | undefined): number {
  const jobs = raw === undefined ? Math.min(48, availableParallelism()) : Number(raw);
  if (!Number.isSafeInteger(jobs) || jobs < 1 || jobs > 48) {
    throw new Error(`--jobs must be an integer in 1..48`);
  }
  return jobs;
}

function parseTelemetry(raw: string | undefined): "summary" | "trace" {
  const value = raw ?? "summary";
  if (value === "summary" || value === "trace") return value;
  throw new Error(`scale benchmark requires --budget-telemetry=summary or trace`);
}

function parseBreadthPolicy(raw: string | undefined): BreadthPolicy | null {
  if (raw === undefined) return null;
  if (
    raw === "high-budget-three-quarter" ||
    raw === "repair-high-budget-three-quarter" ||
    raw === "repair-three-quarter" ||
    raw === "repair-seven-eighth" ||
    raw === "late-repair-seven-eighth" ||
    raw === "linear-cap-216"
  ) return raw;
  throw new Error(
    `--breadth-policy must be high-budget-three-quarter, ` +
      `repair-high-budget-three-quarter, repair-three-quarter, repair-seven-eighth, ` +
      `late-repair-seven-eighth, ` +
      `or linear-cap-216`,
  );
}

export function scaleBreadthPolicyArgument(argv: string[]): BreadthPolicy | null {
  return parseBreadthPolicy(argumentIn(argv)("breadth-policy"));
}

function parseRepairPolicy(raw: string | undefined): RepairPolicy | null {
  if (raw === undefined) return null;
  if (raw === "protected-one-step-bridge" || raw === "optimistic-axis-bound-bridge") return raw;
  throw new Error(
    `--repair-policy must be protected-one-step-bridge or optimistic-axis-bound-bridge`,
  );
}

export function scaleRepairPolicyArgument(argv: string[]): RepairPolicy | null {
  return parseRepairPolicy(argumentIn(argv)("repair-policy"));
}

function parseRepairSelectionPolicy(raw: string | undefined): RepairSelectionPolicy | null {
  if (raw === undefined) return null;
  if (
    raw === "reserve-cheapest-repair" ||
    raw === "reserve-cheapest-else-deepest" ||
    raw === "worst-target-runway-per-cost"
  ) {
    return raw;
  }
  throw new Error(
    `--repair-selection-policy must be reserve-cheapest-repair or ` +
      `reserve-cheapest-else-deepest, or worst-target-runway-per-cost`,
  );
}

export function scaleRepairSelectionPolicyArgument(
  argv: string[],
): RepairSelectionPolicy | null {
  return parseRepairSelectionPolicy(argumentIn(argv)("repair-selection-policy"));
}

function parseAimImpactPower(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.25 || value > 4) {
    throw new Error(`--aim-impact-power must be in [0.25, 4]`);
  }
  return value;
}

export function scaleAimImpactPowerArgument(argv: string[]): number | null {
  return parseAimImpactPower(argumentIn(argv)("aim-impact-power"));
}

function parseAimTopKExponent(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0.25 || value > 2) {
    throw new Error(`--aim-topk-exponent must be in [0.25, 2]`);
  }
  return value;
}

export function scaleAimTopKExponentArgument(argv: string[]): number | null {
  return parseAimTopKExponent(argumentIn(argv)("aim-topk-exponent"));
}

function parseAimTopKScope(raw: string | undefined): "repair" | null {
  if (raw === undefined) return null;
  if (raw === "repair") return raw;
  throw new Error(`--aim-topk-scope must be repair`);
}

export function scaleAimTopKScopeArgument(argv: string[]): "repair" | null {
  return parseAimTopKScope(argumentIn(argv)("aim-topk-scope"));
}

function parseAimTopKFirstRepairExtra(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0 || value > 8) {
    throw new Error(`--aim-topk-first-repair-extra must be an integer in [0, 8]`);
  }
  return value;
}

export function scaleAimTopKFirstRepairExtraArgument(argv: string[]): number | null {
  return parseAimTopKFirstRepairExtra(argumentIn(argv)("aim-topk-first-repair-extra"));
}

function argumentIn(argv: string[]) {
  return (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function requiredPath(value: string | undefined, message: string): string {
  if (value === undefined || value === "") throw new Error(message);
  return resolve(value);
}

function requireWasm(): void {
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`benchmark scale requires LR_ENGINE=wasm`);
}

function emitComparison(argv: string[], artifactPath: string, artifact: Record<string, any>): void {
  const result = artifact.result;
  emit(argv, {
    schema: MULTI_BUDGET_COMPARISON_SCHEMA,
    status: "complete",
    artifact: relativeToCwd(artifactPath),
    outcome: result.outcome,
    stoppingDepth: result.stoppingDepth,
    referenceScaleHeadline: result.final.referenceScaleHeadline,
    candidateScaleHeadline: result.final.candidateScaleHeadline,
    delta: result.final.delta,
    directionalProbability: result.final.directionalProbability,
    canonicalBudgetDelta: result.canonicalBudget.delta,
    validity: result.validity,
    nextCommand: artifact.nextCommand,
  });
}

function emit(argv: string[], payload: Record<string, unknown>): void {
  if (argv.includes("--json")) {
    console.log(JSON.stringify(payload));
    return;
  }
  if (payload.schema === SCALE_BASELINE_SCHEMA) {
    console.log(`Scale baseline: ${payload.baseline}`);
    console.log(`  headline ${Number(payload.scaleHeadline).toFixed(4)}; seeds ${payload.seeds}; cells ${payload.cells}`);
    console.log(`  next: ${payload.nextCommand}`);
    return;
  }
  console.log(`Scale comparison: ${payload.artifact}`);
  console.log(
    `  ${payload.outcome}; ${Number(payload.candidateScaleHeadline).toFixed(4)} vs ` +
      `${Number(payload.referenceScaleHeadline).toFixed(4)} ` +
      `(delta ${signed(Number(payload.delta))}, P+ ${(100 * Number(payload.directionalProbability)).toFixed(2)}%)`,
  );
  console.log(`  750k delta ${signed(Number(payload.canonicalBudgetDelta))}; validity ${JSON.stringify(payload.validity)}`);
  if (payload.nextCommand !== null) console.log(`  next: ${payload.nextCommand}`);
}

function writeJsonArtifact(path: string, value: unknown): void {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  writeFileAtomicDurable(path, bytes);
  writeFileAtomicDurable(`${path}.sha256`, `${sha256(bytes)}  ${relativeToCwd(path)}\n`);
}

function siblingPath(path: string, suffix: string): string {
  return path.endsWith(".json") ? `${path.slice(0, -5)}${suffix}` : `${path}${suffix}`;
}

function scaleAnalysisPath(path: string): string {
  const projected = siblingPath(path, ".analysis.json");
  return existsSync(projected) ? projected : path;
}

function timestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function relativeToCwd(path: string): string {
  const absolute = resolve(path);
  return absolute.startsWith(`${process.cwd()}/`) ? absolute.slice(process.cwd().length + 1) : absolute;
}

function signed(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}

function scaleAction(argv: string[]): "baseline" | "eval" | "compare" {
  const action = argv.find((arg) => !arg.startsWith("--"));
  if (action === "baseline" || action === "eval" || action === "compare") return action;
  throw new Error(`usage: benchmark scale baseline|eval|compare [options]`);
}
