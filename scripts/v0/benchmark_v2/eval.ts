/**
 * The eval chain (RFC C.2): one command from informational screen to
 * promotion verdict.
 *
 * Stage 0 (default): a probe run of the current tree vs the stored baseline
 * probe reference — full integrity path, no gating, no state consumed.
 *
 * --to-verdict: declare a certified operating point (immutable, ledgered,
 * before any confirmation compile), run both frozen snapshots on a fresh
 * paired epoch in ~wave increments, take the declared futility looks, and
 * decide at the declared depth with the certified inference machinery.
 * Exit codes per mode: stage 0 emits 0/1; --to-verdict emits 0 accept,
 * 2 inconclusive, 3 reject, 4 futility stop, 1 invalid.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { benchmarkEvalPolicy, cheapestOperatingPoint } from "../../../benchmark/v2/eval-policy.ts";
import { applyJolt } from "../../produce/seed.ts";
import {
  appendAttemptEvent,
  assertAttemptDeclarationCurrent,
  initializeLedgerFromBaseline,
  readEraState,
  retryStatus,
  assertBudgetAllows,
  withAttemptLedgerTransaction,
  type AttemptPaths,
  type EraState,
} from "./attempts.ts";
import {
  requireCertifiedOperatingPoint,
  requireCurrentDecisionCalibration,
  type CertifiedOperatingPoint,
} from "./calibration_guard.ts";
import { latestSuccessfulResults } from "./checkpoint_model.ts";
import {
  createCompilerSnapshot,
  createSnapshotWorkspace,
  disposeSnapshotWorkspace,
  runInWorkspace,
  type SnapshotBenchmarkRun,
  type SnapshotWorkspace,
} from "./compiler_snapshot.ts";
import {
  assertCurrentDecisionContract,
  allocateCanonicalSeedBase,
  declareEvalAttempt,
  freshAttemptId,
  readBaselineContract,
  readEvalDeclaration,
  retainSnapshotRun,
  DEFAULT_BASELINE_PATH,
  type BaselineContract,
  type ConfirmationMode,
  type EvalDeclaration,
} from "./confirmation.ts";
import {
  evalDecision,
  screeningComparison,
  suiteAtDepth,
  writeDecisionArtifact,
} from "./decide.ts";
import {
  pairedV2DecisionForCalibration,
  type DecisionRun,
} from "./decision_model.ts";
import {
  evalFutilityStops,
  evalFutilityUpperBound,
  evalRunsAtLook,
} from "./eval_chain_inference.ts";
import {
  evalNextCommand,
  renderEvalVerdict,
  renderLookLine,
  renderStage0,
} from "./eval_report.ts";
import { buildAxisContract, scoreV2Report, type AxisContract } from "./evaluator.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "./model.ts";
import { runBenchmarkV2, compilerCandidateIdentity } from "./runner.ts";
import { runnerCompatibilityApproval } from "./runner_compatibility.ts";
import {
  RUNNER_IMPLEMENTATION_SOURCE_FILES,
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  resolvedSeedSchedule,
  suiteIdentity,
  type SuiteManifest,
} from "./suite_model.ts";

const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const EXIT = benchmarkEvalPolicy.exitCodes;

type EvalContext = {
  suite: SuiteManifest;
  sources: ReturnType<typeof resolveSources>;
  contracts: Map<string, AxisContract>;
  suiteFingerprint: string;
};

export type DeclarationFreshness = {
  baseline: BaselineContract;
  decisionContract: ReturnType<typeof requireCurrentDecisionCalibration>;
  certified: CertifiedOperatingPoint;
};

/**
 * Re-read every mutable declaration dependency while the attempt-ledger lock
 * is held. This closes the scheduler window between snapshot preparation and
 * the append that spends alpha and reserves a seed epoch.
 */
export function revalidateDeclarationUnderLock(input: {
  state: EraState;
  expectedSuiteFingerprint: string;
  sources: EvalContext["sources"];
  baselinePath: string;
  mode: ConfirmationMode;
  margin: number | null;
  depth: number;
}): DeclarationFreshness {
  const freshSuite = suiteIdentity(SUITE_MANIFEST, SOURCE_MANIFEST, input.sources);
  if (freshSuite.suiteFingerprint !== input.expectedSuiteFingerprint) {
    throw new Error(`suite changed while the eval attempt was being prepared; restart the declaration`);
  }
  const baseline = readBaselineContract(input.baselinePath);
  if (input.state.baselineLabel !== baseline.label) {
    throw new Error(`baseline or era changed while the eval attempt was being prepared; restart the declaration`);
  }
  const decisionContract = requireCurrentDecisionCalibration(input.expectedSuiteFingerprint);
  assertCurrentDecisionContract(baseline, decisionContract);
  const certified = requireCertifiedOperatingPoint(
    input.mode,
    input.margin,
    input.depth,
    input.expectedSuiteFingerprint,
  );
  return { baseline, decisionContract, certified };
}

export async function runEvalCommand(argv = process.argv.slice(2)): Promise<number> {
  assertEvalArguments(argv);
  const hasFlag = (name: string): boolean => argv.includes(`--${name}`);
  if (hasFlag("abort-in-flight")) return abortInFlightAttempt(argv);
  return hasFlag("to-verdict") ? runToVerdict(argv) : runStage0(argv);
}

type EvalInvocation = "stage 0" | "confirmation" | "abort";

/**
 * Eval arguments are deliberately mode-scoped. A misspelled or misplaced
 * output flag must fail before preparation or a paid compiler run, rather
 * than being silently ignored by the branch that does not consume it.
 */
export function assertEvalArguments(argv: string[]): void {
  const abort = argv.includes("--abort-in-flight");
  const verdict = argv.includes("--to-verdict");
  if (abort && verdict) throw new Error(`--abort-in-flight cannot be combined with --to-verdict`);

  const invocation: EvalInvocation = abort ? "abort" : verdict ? "confirmation" : "stage 0";
  const booleans = new Set<string>(
    invocation === "stage 0" ? ["resume", "json"]
      : invocation === "confirmation" ? ["to-verdict", "resume", "json", "acknowledge-retry"]
        : ["abort-in-flight", "json"],
  );
  const values = new Set<string>(
    invocation === "stage 0"
      ? ["out", "base", "jobs", "attempts-ledger", "era-state"]
      : invocation === "confirmation"
        ? [
          "baseline", "declaration-dir", "out-dir", "archive-dir", "attempts-ledger", "era-state", "jobs",
          "mode", "margin", "depth", "override-era-budget", "reason", "operator",
        ]
        : ["reason", "attempts-ledger", "era-state"],
  );
  const accepted = [...booleans, ...[...values].map((name) => `${name}=VALUE`)].join(", ");

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      throw new Error(`${invocation} eval does not accept positional argument ${arg}`);
    }
    const equals = arg.indexOf("=");
    const name = arg.slice(2, equals === -1 ? undefined : equals);
    if (equals === -1 && booleans.has(name)) continue;
    if (equals !== -1 && values.has(name) && arg.slice(equals + 1) !== "") continue;
    if (equals === -1 && values.has(name)) {
      throw new Error(`${invocation} eval requires --${name}=VALUE`);
    }
    if (equals !== -1 && booleans.has(name)) {
      throw new Error(`${invocation} eval flag --${name} does not take a value`);
    }
    throw new Error(`${invocation} eval does not accept ${arg}; accepted flags: ${accepted}`);
  }
}

function abortInFlightAttempt(argv: string[]): number {
  const argument = argumentIn(argv);
  const reason = argument("reason")?.trim();
  if (reason === undefined || reason === "") {
    throw new Error(`--abort-in-flight requires --reason=...`);
  }
  const ledgerPaths = attemptPaths(argument);
  const era = readEraState(ledgerPaths);
  if (era.inFlightAttemptId === null) throw new Error(`there is no in-flight eval attempt to abort`);
  const attemptId = era.inFlightAttemptId;
  appendAttemptEvent({ type: "abort", attemptId, reason }, ledgerPaths);
  const payload = evalWorkerFailurePayload({
    stage: "confirmation",
    reason,
    attemptId,
    workerFailures: 0,
    spendCharged: era.attempts.find((attempt) => attempt.attemptId === attemptId)?.spend ?? null,
    evidencePaths: [],
    nextCommand: `npm run benchmark -- eval --to-verdict --acknowledge-retry`,
  });
  if (argv.includes("--json")) console.log(JSON.stringify(payload, null, 2));
  else console.log(`aborted eval attempt ${attemptId}: ${reason}; declared spend stays charged`);
  return EXIT.verdict.invalid;
}

export function evalWorkerFailurePayload(input: {
  stage: "stage0" | "confirmation";
  reason: string;
  attemptId?: string;
  workerFailures: number;
  spendCharged: number | null;
  evidencePaths: string[];
  nextCommand: string;
}): Record<string, unknown> {
  return {
    schema: "line.benchmark-v2.eval-failure.v1",
    status: input.stage === "confirmation" ? "aborted" : "invalid",
    stage: input.stage,
    reason: input.reason,
    ...(input.attemptId === undefined ? {} : { attemptId: input.attemptId }),
    workerFailures: input.workerFailures,
    spendCharged: input.spendCharged,
    evidencePaths: input.evidencePaths,
    nextCommand: input.nextCommand,
  };
}

function argumentIn(argv: string[]) {
  return (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

function runnerBaseArgs(jobs: number): string[] {
  return [
    `--manifest=${resolve(SOURCE_MANIFEST)}`,
    `--heldout-manifest=${resolve(HELDOUT_MANIFEST)}`,
    `--suite=${resolve(SUITE_MANIFEST)}`,
    `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
    `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
    `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
    `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
    `--jobs=${jobs}`,
  ];
}

async function loadEvalContext(): Promise<EvalContext> {
  const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
  const suite = loadSuiteManifest(SUITE_MANIFEST, sources);
  const identity = suiteIdentity(SUITE_MANIFEST, SOURCE_MANIFEST, sources);
  const contracts = new Map<string, AxisContract>();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  return { suite, sources, contracts, suiteFingerprint: identity.suiteFingerprint };
}

// ── Stage 0 ──────────────────────────────────────────────────────────────────

async function runStage0(argv: string[]): Promise<number> {
  const argument = argumentIn(argv);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`eval requires LR_ENGINE=wasm`);
  assertStage0ReferenceComparable();
  const jobs = Number(argument("jobs") ?? Math.min(48, availableParallelism()));
  const stamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  const outPath = resolve(argument("out") ?? `generated/benchmark-v2/eval/stage0-${stamp}.json`);
  mkdirSync(resolve("generated/benchmark-v2/eval"), { recursive: true });
  const run = await runBenchmarkV2("development", [
    "--profile=probe",
    ...runnerBaseArgs(jobs),
    `--out=${outPath}`,
    ...(argv.includes("--resume") ? ["--resume"] : []),
  ]);
  if (run.workerFailures > 0) {
    console.error(`stage 0 has ${run.workerFailures} worker failure(s); re-run with --resume`);
    if (argv.includes("--json")) {
      console.log(JSON.stringify(evalWorkerFailurePayload({
        stage: "stage0",
        reason: "one or more compiler workers failed; no screening decision was made",
        workerFailures: run.workerFailures,
        spendCharged: null,
        evidencePaths: [relativeToCwd(run.outputPath)],
        nextCommand: `npm run benchmark -- eval --resume --out=${relativeToCwd(outPath)}`,
      }), null, 2));
    }
    return EXIT.stage0.invalid;
  }
  const screen = await screeningComparison(outPath, { basePath: argument("base") });
  const identical = scoreIdenticalFraction(screen.base.archive, screen.candidate.archive);
  const era = readEraStateIfPresent(argument);
  const probeDepth = screen.candidate.archive.identity.seedSchedule.seedsPerBudget;
  const confirmDepth = cheapestOperatingPoint("improvement", null)?.depth ?? 48;
  const report = {
    result: screen.result,
    baseLabel: screen.baseLabel,
    archivePath: relativeToCwd(outPath),
    scoreIdenticalFraction: identical,
    era,
    menu: benchmarkEvalPolicy.operatingPoints.map((point) => ({
      id: point.id,
      mode: point.mode,
      margin: point.margin,
      depth: point.depth,
    })),
  };
  if (argv.includes("--json")) {
    console.log(JSON.stringify({ stage: 0, ...report }, null, 2));
  } else {
    console.log(renderStage0(report, probeDepth, confirmDepth));
  }
  return EXIT.stage0.completed;
}

/** Refuse known identity mismatches before paying for the probe compile. */
export function assertStage0ReferenceComparable(): void {
  const baseline = readBaselineContract();
  const probe = JSON.parse(readFileSync(resolve("benchmark/v2/probe-baseline.json"), "utf8"));
  const currentCompiler = compilerCandidateIdentity("wasm");
  if (currentCompiler.engineArtifactFingerprint !== baseline.compilerSnapshot.engineArtifactFingerprint) {
    throw new Error(
      `stage 0 engine artifact differs from the retained probe reference; restore the accepted artifact or establish a new baseline`,
    );
  }
  runnerCompatibilityApproval(
    probe.probe.implementation_fingerprint,
    fingerprintFiles(RUNNER_IMPLEMENTATION_SOURCE_FILES),
    baseline.suiteFingerprint,
  );
}

// ── Verdict chain ────────────────────────────────────────────────────────────

async function runToVerdict(argv: string[]): Promise<number> {
  const argument = argumentIn(argv);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`eval requires LR_ENGINE=wasm`);
  const baselinePath = resolve(argument("baseline") ?? DEFAULT_BASELINE_PATH);
  const declarationDir = resolve(argument("declaration-dir") ?? "benchmark/v2/confirmations");
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/eval");
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const ledgerPaths = attemptPaths(argument);
  const jobs = Number(argument("jobs") ?? Math.min(48, availableParallelism()));
  const json = argv.includes("--json");

  const context = await loadEvalContext();
  let baseline = readBaselineContract(baselinePath);
  if (context.suiteFingerprint !== baseline.suiteFingerprint) {
    throw new Error(`suite differs from the baseline contract; establish a new baseline`);
  }
  let decisionContract = requireCurrentDecisionCalibration(context.suiteFingerprint);
  assertCurrentDecisionContract(baseline, decisionContract);

  if (argv.includes("--resume")) {
    return resumeAttempt(argv, context, baseline, outDir, archiveDir, ledgerPaths, jobs, json);
  }

  const mode = parseEvalMode(argument("mode"));
  const margin = parseEvalMargin(mode, argument("margin"));
  const depth = argument("depth") === undefined
    ? (cheapestOperatingPoint(mode, margin)?.depth ??
      (() => { throw new Error(`no certified operating point offers mode ${mode}${margin === null ? "" : ` m=${margin}`}`); })())
    : Number(argument("depth"));
  let certified = requireCertifiedOperatingPoint(mode, margin, depth, context.suiteFingerprint);

  if (!existsSync(ledgerPaths.ledger)) {
    initializeLedgerFromBaseline(baselinePath, ledgerPaths);
    console.log(`eval ledger bootstrapped from the baseline of record`);
  }
  const overrideCap = argument("override-era-budget");
  if (overrideCap !== undefined) {
    const reason = argument("reason");
    if (reason === undefined || reason.trim() === "") {
      throw new Error(`--override-era-budget requires --reason=...`);
    }
    withAttemptLedgerTransaction(ledgerPaths, (transaction) =>
      transaction.append({
        type: "override",
        eraId: transaction.state.eraId!,
        previousCap: transaction.state.budgetCap,
        newCap: Number(overrideCap),
        reason,
        operator: argument("operator") ?? "unspecified",
      })
    );
  }
  const identity = compilerCandidateIdentity("wasm");
  const budgets = context.suite.profiles.canonical.budgets;
  const seedCount = budgets.length * depth;
  const attemptId = freshAttemptId();
  const candidateSnapshot = createCompilerSnapshot(`${attemptId}-candidate`, archiveDir);
  if (candidateSnapshot.candidateFingerprint !== identity.candidateFingerprint) {
    throw new Error(`candidate changed while its eval snapshot was being created`);
  }

  const acknowledgedRetry = argv.includes("--acknowledge-retry");
  const declaration = withAttemptLedgerTransaction(ledgerPaths, (transaction) => {
    // Baseline, suite, calibration, and certification may have changed while
    // the candidate snapshot was being created. Re-read them under the same
    // lock that commits the declaration so migration/rebaseline cannot land
    // in the check-to-append window.
    const fresh = revalidateDeclarationUnderLock({
      state: transaction.state,
      expectedSuiteFingerprint: context.suiteFingerprint,
      sources: context.sources,
      baselinePath,
      mode,
      margin,
      depth,
    });
    baseline = fresh.baseline;
    decisionContract = fresh.decisionContract;
    certified = fresh.certified;

    const retry = retryStatus(
      transaction.state,
      identity.candidateFingerprint,
      certified.point.criticalAlpha,
    );
    if (retry.priorAttempts > 0 && !acknowledgedRetry) {
      throw new Error(
        `this candidate was already attempted ${retry.priorAttempts} time(s); ` +
        `a retry compounds nominal alpha to ${retry.compoundAlpha} ` +
        `(certified spend is accounted separately) — pass --acknowledge-retry to proceed`,
      );
    }
    assertBudgetAllows(transaction.state, certified.spend);

    // The epoch is derived and committed under the same lock, so two eval
    // processes cannot observe the same seed ledger or both declare.
    const canonicalSeedBase = allocateCanonicalSeedBase(transaction.state.seedLedger, seedCount);
    const schedule = resolvedSeedSchedule(
      context.suite,
      "canonical",
      [...budgets],
      depth,
      canonicalSeedBase,
    );
    assertEpochDisjointFromManifest(context.suite, schedule);
    const seedScheduleFingerprint = sha256(JSON.stringify(schedule));
    const declared = declareEvalAttempt({
      attemptId,
      baseline,
      decisionContract,
      candidateFingerprint: identity.candidateFingerprint,
      candidateSnapshot,
      canonicalSeedBase,
      seedScheduleFingerprint,
      mode,
      margin,
      operatingPointId: certified.point.id,
      depth,
      criticalAlpha: certified.point.criticalAlpha,
      futilitySchedule: [...certified.point.futilitySchedule],
      futilityAlpha: certified.point.futilityAlpha,
      eraBudgetSpend: certified.spend,
      retryAcknowledged: acknowledgedRetry,
      certificationFingerprint: certified.certificationFingerprint,
      declarationDir,
    });
    const era = transaction.append({
      type: "declare",
      eraId: transaction.state.eraId!,
      attemptId,
      declarationPath: relativeToCwd(declared.declarationPath),
      declarationSha256: declared.declarationSha256,
      candidateFingerprint: identity.candidateFingerprint,
      operatingPointId: certified.point.id,
      mode,
      margin,
      depth,
      spend: certified.spend,
      certificationFingerprint: certified.certificationFingerprint,
      canonicalSeedBase,
      seedCount,
      seedScheduleFingerprint,
      retryAcknowledged: acknowledgedRetry,
    });
    return { declared, era, retry, canonicalSeedBase };
  });
  const { declared, era, retry, canonicalSeedBase } = declaration;
  console.log(`declared eval attempt ${attemptId}: ${certified.point.id}, epoch base ${canonicalSeedBase}, spend ${certified.spend}`);

  return executeAttempt(
    declared.declaration,
    declared.declarationPath,
    context,
    baseline,
    certified,
    era,
    retry,
    { outDir, archiveDir, ledgerPaths, jobs, json },
  );
}

async function resumeAttempt(
  argv: string[],
  context: EvalContext,
  baseline: BaselineContract,
  outDir: string,
  archiveDir: string,
  ledgerPaths: ReturnType<typeof attemptPaths>,
  jobs: number,
  json: boolean,
): Promise<number> {
  const era = readEraState(ledgerPaths);
  if (era.inFlightAttemptId === null) {
    // A settled attempt is durable: resuming it re-reports its outcome
    // without recompiling anything.
    const latest = era.attempts.at(-1);
    if (latest?.outcome === "futility-stop") {
      const stop = readAttemptEventsFor(ledgerPaths, latest.attemptId).find((event) => event.type === "futility");
      console.log(`attempt ${latest.attemptId} already stopped for futility at look k=${stop?.k}; the stop is durable`);
      return EXIT.verdict.futilityStop;
    }
    if (latest !== undefined && latest.outcome !== null) {
      console.log(`attempt ${latest.attemptId} already concluded: ${latest.outcome}`);
      return latest.outcome === "accept"
        ? EXIT.verdict.accept
        : latest.outcome === "inconclusive" || latest.outcome === "unresolved"
        ? EXIT.verdict.inconclusive
        : latest.outcome === "aborted"
        ? EXIT.verdict.invalid
        : EXIT.verdict.reject;
    }
    throw new Error(`--resume requires an in-flight eval attempt`);
  }
  const declareEvent = findDeclareEvent(era, ledgerPaths);
  const { declaration, declarationSha256 } = readEvalDeclaration(resolve(declareEvent.declarationPath));
  if (declarationSha256 !== declareEvent.declarationSha256) {
    throw new Error(`eval declaration changed since it was ledgered; the attempt is void`);
  }
  if (
    declaration.baselineInferenceFingerprint !== baseline.inferenceFingerprint ||
    declaration.baselineProtocolFingerprint !== baseline.protocolFingerprint ||
    declaration.baselineCalibrationFingerprint !== baseline.calibrationFingerprint
  ) throw new Error(`running eval declaration does not match the baseline decision contract`);
  const certified = requireCertifiedOperatingPoint(
    declaration.mode,
    declaration.margin,
    declaration.depth,
    context.suiteFingerprint,
  );
  if (certified.certificationFingerprint !== declaration.certificationFingerprint) {
    throw new Error(`certification evidence changed since this attempt was declared; the declared stopping behavior is no longer authorized`);
  }
  execFileSync("git", ["worktree", "prune"], { stdio: "ignore" });
  const retry = retryStatus(era, declaration.candidateFingerprint, certified.point.criticalAlpha);
  return executeAttempt(
    declaration,
    resolve(declareEvent.declarationPath),
    context,
    baseline,
    certified,
    era,
    { priorAttempts: Math.max(0, retry.priorAttempts - 1), compoundAlpha: retry.compoundAlpha },
    { outDir, archiveDir, ledgerPaths, jobs, json },
  );
}

async function executeAttempt(
  declaration: EvalDeclaration,
  declarationPath: string,
  context: EvalContext,
  baseline: BaselineContract,
  certified: CertifiedOperatingPoint,
  era: EraState,
  retry: { priorAttempts: number; compoundAlpha: number },
  options: {
    outDir: string;
    archiveDir: string;
    ledgerPaths: ReturnType<typeof attemptPaths>;
    jobs: number;
    json: boolean;
  },
): Promise<number> {
  const { outDir, archiveDir, ledgerPaths, jobs, json } = options;
  mkdirSync(outDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });
  const basePath = resolve(outDir, `${declaration.attemptId}-baseline-development.json`);
  const candidatePath = resolve(outDir, `${declaration.attemptId}-development.json`);
  const segments = [...declaration.futilitySchedule, declaration.depth];
  const attemptEvents = readAttemptEventsFor(ledgerPaths, declaration.attemptId);
  const lookEvents = attemptEvents.filter((event) => event.type === "look");
  const takenLooks = new Set(lookEvents.map((event) => event.k));
  const looksSummary: Array<{ k: number; fired: boolean }> = lookEvents
    .map((event) => ({ k: event.k, fired: event.fired }))
    .sort((a, b) => a.k - b.k);

  const durableStop = recoverDurableFutilityStop(declaration, ledgerPaths);
  if (durableStop !== null) {
    if (json) {
      console.log(JSON.stringify(evalFutilityJsonPayload({
        attemptId: declaration.attemptId,
        k: durableStop.k,
        upperBound: durableStop.upperBound,
        threshold: durableStop.threshold,
        spendCharged: declaration.eraBudgetSpend,
      }), null, 2));
    } else {
      console.log(
        `recovered durable futility stop at k=${durableStop.k}: fired look upper bound ` +
        `${durableStop.upperBound.toFixed(2)} is below ${durableStop.threshold.toFixed(2)}; spend stays charged`,
      );
      console.log(`  nextCommand: ${evalNextCommand("futility-stop", declaration.attemptId)}`);
    }
    return EXIT.verdict.futilityStop;
  }

  let declareEvent = assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
  console.log(`eval attempt ${declaration.attemptId}: ${segments.length} segments to depth ${declaration.depth}`);
  const baseWorkspace = createSnapshotWorkspace(baseline.compilerSnapshot);
  let candidateWorkspace: SnapshotWorkspace | undefined;
  try {
    candidateWorkspace = createSnapshotWorkspace(declaration.candidateSnapshot);
    for (const k of segments) {
      declareEvent = assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
      const waveArgs = [
        "--profile=canonical",
        ...runnerBaseArgs(jobs),
        `--confirmation-declaration=${declarationPath}`,
        `--canonical-seed-base=${declaration.canonicalSeedBase}`,
        `--seeds-per-budget=${declaration.depth}`,
        `--through-seed-slot=${k}`,
      ];
      const baseRun = runWave(baseWorkspace, waveArgs, basePath, "baseline arm");
      assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
      const candidateRun = runWave(candidateWorkspace, waveArgs, candidatePath, "candidate arm");
      declareEvent = assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
      if (baseRun.workerFailures > 0 || candidateRun.workerFailures > 0) {
        const reason = `persistent worker failures at segment k=${k} after one retry`;
        appendAttemptEvent({
          type: "abort",
          attemptId: declaration.attemptId,
          reason,
        }, ledgerPaths);
        const payload = evalWorkerFailurePayload({
          stage: "confirmation",
          reason,
          attemptId: declaration.attemptId,
          workerFailures: baseRun.workerFailures + candidateRun.workerFailures,
          spendCharged: declaration.eraBudgetSpend,
          evidencePaths: [
            relativeToCwd(`${basePath}.checkpoint.jsonl`),
            relativeToCwd(`${candidatePath}.checkpoint.jsonl`),
          ],
          nextCommand: `npm run benchmark -- eval --to-verdict --acknowledge-retry`,
        });
        if (json) console.log(JSON.stringify(payload, null, 2));
        else {
          console.error(
            `persistent worker failures at k=${k}; attempt aborted, spend ${declaration.eraBudgetSpend} stays charged; ` +
            `retry with --acknowledge-retry (failures never become verdicts)`,
          );
        }
        return EXIT.verdict.invalid;
      }
      if (k < declaration.depth) {
        if (takenLooks.has(k)) continue;
        const look = interimLook(basePath, candidatePath, k, declaration, context);
        appendAttemptEvent({
          type: "look",
          attemptId: declaration.attemptId,
          k,
          delta: look.delta,
          standardError: look.standardError,
          upperBound: look.upperBound,
          fired: look.fired,
        }, ledgerPaths);
        looksSummary.push({ k, fired: look.fired });
        console.log(renderLookLine({ ...look, k, depth: declaration.depth, threshold: look.threshold }));
        if (look.fired) {
          appendAttemptEvent({
            type: "futility",
            attemptId: declaration.attemptId,
            k,
            upperBound: look.upperBound,
            threshold: look.threshold,
          }, ledgerPaths);
          if (json) {
            console.log(JSON.stringify(evalFutilityJsonPayload({
              attemptId: declaration.attemptId,
              k,
              upperBound: look.upperBound,
              threshold: look.threshold,
              spendCharged: declaration.eraBudgetSpend,
            }), null, 2));
          } else {
            console.log(`futility stop at k=${k}: the 95% upper bound ${look.upperBound.toFixed(2)} is below ${look.threshold.toFixed(2)}; spend stays charged`);
            console.log(`  nextCommand: ${evalNextCommand("futility-stop", declaration.attemptId)}`);
          }
          return EXIT.verdict.futilityStop;
        }
        continue;
      }

      // Final segment: full-scope archives assembled by the runner.
      const retainedBase = retainSnapshotRun(baseRun, archiveDir, `${declaration.attemptId}-baseline-development`);
      const retainedCandidate = retainSnapshotRun(candidateRun, archiveDir, `${declaration.attemptId}-development`);
      const decided = await evalDecision(basePath, candidatePath, {
        mode: declaration.mode,
        margin: declaration.margin,
        depth: declaration.depth,
        declaration: {
          path: declarationPath,
          sha256: declareEvent.declarationSha256,
          seedScheduleFingerprint: declaration.seedScheduleFingerprint,
          baselineCandidateFingerprint: declaration.baselineCandidateFingerprint,
          candidateFingerprint: declaration.candidateFingerprint,
        },
      });
      decided.artifact.nextCommand = evalNextCommand(decided.artifact.result.outcome, declaration.attemptId);
      const artifactPath = evalVerdictArtifactPath(
        archiveDir,
        declaration.attemptId,
        decided.artifact.result.outcome,
      );
      writeDecisionArtifact(artifactPath, decided.artifact);
      if (decided.artifact.result.outcome === "accept") {
        assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
        const qualificationPath = resolve(outDir, `${declaration.attemptId}-qualification.json`);
        const qualificationRun = runInWorkspace(candidateWorkspace, "qualification", [
          "--profile=canonical",
          ...runnerBaseArgs(jobs),
          `--development-archive=${candidatePath}`,
          `--confirmation-declaration=${declarationPath}`,
          `--canonical-seed-base=${declaration.canonicalSeedBase}`,
          ...(existsSync(`${qualificationPath}.checkpoint.jsonl`) ? ["--resume"] : []),
        ], qualificationPath);
        assertQualificationSucceeded(qualificationRun);
        assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
        retainSnapshotRun(qualificationRun, archiveDir, `${declaration.attemptId}-qualification`);
        console.log(`qualification monitor: ${qualificationRun.qualificationMonitorScore?.toFixed(2)} (indicative sidecar)`);
      }
      assertAttemptDeclarationCurrent(declaration.attemptId, ledgerPaths);
      const finalEra = appendAttemptEvent({
        type: "verdict",
        attemptId: declaration.attemptId,
        outcome: decided.artifact.result.outcome,
        decisionArtifactPath: relativeToCwd(artifactPath),
        decisionArtifactSha256: sha256(readFileSync(artifactPath).toString("utf8")),
      }, ledgerPaths);
      if (json) {
        console.log(JSON.stringify(evalVerdictJsonPayload({
          attemptId: declaration.attemptId,
          artifactPath: relativeToCwd(artifactPath),
          artifact: decided.artifact,
          era: finalEra,
          baseArchive: retainedBase.archive,
          candidateArchive: retainedCandidate.archive,
          certified,
          spendCharged: declaration.eraBudgetSpend,
        }), null, 2));
      } else {
        console.log(renderEvalVerdict({
          artifact: decided.artifact,
          artifactPath: relativeToCwd(artifactPath),
          certified,
          era: finalEra,
          attemptSpend: declaration.eraBudgetSpend,
          priorAttempts: retry.priorAttempts,
          compoundAlpha: retry.compoundAlpha,
          looks: looksSummary,
        }));
      }
      const outcome = decided.artifact.result.outcome;
      return outcome === "accept"
        ? EXIT.verdict.accept
        : outcome === "inconclusive" || outcome === "unresolved"
        ? EXIT.verdict.inconclusive
        : EXIT.verdict.reject;
    }
    throw new Error(`eval segments were exhausted without a verdict`);
  } finally {
    if (candidateWorkspace !== undefined) disposeSnapshotWorkspace(candidateWorkspace);
    disposeSnapshotWorkspace(baseWorkspace);
  }
}

export function evalVerdictJsonPayload(input: {
  attemptId: string;
  artifactPath: string;
  artifact: { schema: string; result: any; hint: string | null; nextCommand: string };
  era: EraState;
  baseArchive: string;
  candidateArchive: string;
  certified: CertifiedOperatingPoint;
  spendCharged: number;
}): Record<string, unknown> {
  const result = input.artifact.result;
  return {
    schema: "line.benchmark-v2.eval-result.v1",
    status: result.outcome,
    attemptId: input.attemptId,
    artifactPath: input.artifactPath,
    artifact: {
      schema: input.artifact.schema,
      result: {
        outcome: result.outcome,
        promotable: result.promotable,
        baseHeadline: result.baseHeadline,
        candidateHeadline: result.candidateHeadline,
        delta: result.delta,
        standardError: result.uncertainty.seed.standardError,
        lowerBound: result.confidence.lowerBound,
        upperBound: result.confidence.upperBound,
        validity: result.validity,
        perBudget: result.perBudget.map((entry: any) => ({
          budget: entry.budget,
          delta: entry.delta,
          lowerBound: entry.confidence.lowerBound,
          upperBound: entry.confidence.upperBound,
          baseValid: entry.baseValid,
          candidateValid: entry.candidateValid,
          total: entry.total,
        })),
        perStratum: result.perStratum.map((entry: any) => ({
          stratum: entry.stratum,
          delta: entry.delta,
          lowerBound: entry.confidence.lowerBound,
          upperBound: entry.confidence.upperBound,
          baseValid: entry.baseValid,
          candidateValid: entry.candidateValid,
          total: entry.total,
        })),
      },
      hint: input.artifact.hint,
      nextCommand: input.artifact.nextCommand,
    },
    operatingPoint: {
      id: input.certified.point.id,
      depth: input.certified.point.depth,
      criticalAlpha: input.certified.point.criticalAlpha,
      certifiedDetectableEffect: input.certified.mde80,
    },
    era: {
      eraId: input.era.eraId,
      budgetSpent: input.era.budgetSpent,
      budgetCap: input.era.budgetCap,
      cumulativeExpectedFalseAccepts: input.era.cumulativeExpectedFalseAccepts,
      spendCharged: input.spendCharged,
    },
    evidence: {
      baseArchive: input.baseArchive,
      candidateArchive: input.candidateArchive,
    },
  };
}

export function evalVerdictArtifactPath(archiveDir: string, attemptId: string, outcome: string): string {
  return resolve(archiveDir, `${attemptId}-verdict-${outcome}.json`);
}

export function evalFutilityJsonPayload(input: {
  attemptId: string;
  k: number;
  upperBound: number;
  threshold: number;
  spendCharged: number;
}): Record<string, unknown> {
  return {
    schema: "line.benchmark-v2.eval-result.v1",
    status: "futility-stop",
    attemptId: input.attemptId,
    look: { k: input.k, upperBound: input.upperBound, threshold: input.threshold },
    era: { spendCharged: input.spendCharged },
    nextCommand: evalNextCommand("futility-stop", input.attemptId),
  };
}

/**
 * A fired look is already binding evidence. If the process died between the
 * look append and its settlement event, resume must settle that stop before
 * opening workspaces or executing another row.
 */
export function recoverDurableFutilityStop(
  declaration: Pick<EvalDeclaration, "attemptId" | "mode" | "margin">,
  ledgerPaths: AttemptPaths,
): { k: number; upperBound: number; threshold: number } | null {
  return withAttemptLedgerTransaction(ledgerPaths, (transaction) => {
    const events = transaction.events.filter((event) =>
      "attemptId" in event && event.attemptId === declaration.attemptId
    );
    const existing = events.find((event) => event.type === "futility");
    if (existing?.type === "futility") {
      return { k: existing.k, upperBound: existing.upperBound, threshold: existing.threshold };
    }
    const fired = events.find((event) => event.type === "look" && event.fired);
    if (fired?.type !== "look") return null;
    const threshold = declaration.mode === "simplification" ? -(declaration.margin ?? 0) : 0;
    transaction.append({
      type: "futility",
      attemptId: declaration.attemptId,
      k: fired.k,
      upperBound: fired.upperBound,
      threshold,
    });
    return { k: fired.k, upperBound: fired.upperBound, threshold };
  });
}

/** One wave on one arm; a failed wave is retried once before the caller aborts. */
function runWave(
  workspace: SnapshotWorkspace,
  waveArgs: string[],
  outputPath: string,
  label: string,
): ReturnType<typeof runInWorkspace> {
  const invoke = (): ReturnType<typeof runInWorkspace> => {
    waitForRunLock(outputPath, label);
    return runInWorkspace(workspace, "development", [
      ...waveArgs,
      ...(existsSync(`${outputPath}.checkpoint.jsonl`) ? ["--resume"] : []),
    ], outputPath);
  };
  try {
    const run = invoke();
    if (run.workerFailures === 0) return run;
    console.error(`${label}: ${run.workerFailures} worker failure(s); retrying the wave once`);
  } catch (error) {
    console.error(`${label}: wave failed (${(error as Error).message}); retrying once`);
  }
  try {
    return invoke();
  } catch (error) {
    // The caller records the abort; failures never become verdicts.
    console.error(`${label}: wave failed again (${(error as Error).message})`);
    return {
      mode: "development",
      outputPath,
      summaryPath: outputPath,
      archiveSha256: "",
      compressedArchiveSha256: "",
      headline: null,
      qualificationMonitorScore: null,
      workerFailures: 1,
    };
  }
}

function interimLook(
  basePath: string,
  candidatePath: string,
  k: number,
  declaration: EvalDeclaration,
  context: EvalContext,
): {
  delta: number;
  standardError: number;
  upperBound: number;
  threshold: number;
  fired: boolean;
  scoreIdenticalFraction: number;
} {
  const baseRuns = checkpointDecisionRuns(basePath, k, declaration, context);
  const candidateRuns = checkpointDecisionRuns(candidatePath, k, declaration, context);
  const decision = pairedV2DecisionForCalibration(
    baseRuns,
    candidateRuns,
    suiteAtDepth(context.suite, k),
    {
      profile: "canonical",
      mode: declaration.mode,
      margin: declaration.mode === "simplification" ? declaration.margin ?? undefined : undefined,
    },
  );
  const seed = decision.uncertainty.seed;
  const upperBound = evalFutilityUpperBound(
    seed.estimate,
    seed.standardError,
    seed.degreesOfFreedom,
    declaration.futilityAlpha,
  );
  const threshold = decision.threshold;
  const paired = new Map(baseRuns.map((run) => [decisionRunKey(run), run.score.score]));
  const identical = candidateRuns.filter((run) => paired.get(decisionRunKey(run)) === run.score.score).length;
  return {
    delta: decision.delta,
    standardError: seed.standardError,
    upperBound: round4(upperBound),
    threshold,
    fired: evalFutilityStops({
      estimate: seed.estimate,
      standardError: seed.standardError,
      degreesOfFreedom: seed.degreesOfFreedom,
      futilityAlpha: declaration.futilityAlpha,
      threshold,
    }),
    scoreIdenticalFraction: candidateRuns.length === 0 ? 0 : identical / candidateRuns.length,
  };
}

function checkpointDecisionRuns(
  archivePath: string,
  k: number,
  declaration: EvalDeclaration,
  context: EvalContext,
): DecisionRun[] {
  const checkpointPath = `${archivePath}.checkpoint.jsonl`;
  const lines = readFileSync(checkpointPath, "utf8").split("\n").filter((line) => line.trim() !== "");
  const results = lines.slice(1)
    .map((line) => JSON.parse(line))
    .filter((entry) => entry.type === "result")
    .map((entry) => entry.result);
  const latest = latestSuccessfulResults(
    results,
    (result: any) => `${result.task.sourceId}\0${result.task.budget}\0${result.task.seedSlot}\0${result.task.actualSeed}`,
  );
  const decisionRuns = latest.map((result: any) => {
    const rescored = rescoreCheckpointRow(result, context);
    return checkpointResultToDecisionRun(result, rescored);
  });
  const lookResults = evalRunsAtLook(decisionRuns, k);
  const expected = context.suite.profiles.canonical.budgets.length * k * canonicalMembers(context.suite).length;
  if (lookResults.length !== expected) {
    throw new Error(`${checkpointPath}: incomplete scope for look k=${k} (${lookResults.length}/${expected} rows)`);
  }
  return lookResults;
}

/** Flatten the runner's nested checkpoint shape before applying look-depth inference. */
export function checkpointResultToDecisionRun(
  result: {
    task: { sourceId: string; budget: number; seedSlot: number; actualSeed: number };
  },
  score: { score: number; valid: boolean },
): DecisionRun {
  return {
    sourceId: result.task.sourceId,
    budget: result.task.budget,
    seedSlot: result.task.seedSlot,
    actualSeed: result.task.actualSeed,
    score: { score: score.score, valid: score.valid },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * A crash can orphan a wave's runner child; its exclusive run lock outlives
 * the parent until the child drains. Waiting for the holder (instead of
 * treating the refusal as a wave failure) keeps a resumed attempt from
 * aborting itself against its own orphan.
 */
function waitForRunLock(outputPath: string, label: string, timeoutMs = 15 * 60_000): void {
  const lockPath = `${outputPath}.lock`;
  const startedAt = Date.now();
  for (;;) {
    if (!existsSync(lockPath)) return;
    let holder: { pid?: number };
    try {
      holder = JSON.parse(readFileSync(lockPath, "utf8"));
    } catch {
      return; // partially written or removed mid-read; the runner re-checks
    }
    try {
      process.kill(holder.pid!, 0);
    } catch {
      return; // holder is dead; the runner steals stale locks itself
    }
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`${label}: run lock ${lockPath} is still held by live pid ${holder.pid} after ${timeoutMs / 60_000} minutes`);
    }
    console.log(`${label}: waiting for the previous wave's runner (pid ${holder.pid}) to drain...`);
    execFileSync("sleep", ["5"]);
  }
}

function rescoreCheckpointRow(result: any, context: EvalContext): { score: number; valid: boolean } {
  const contract = context.contracts.get(result.task.sourceId);
  if (contract === undefined) throw new Error(`${result.task.sourceId}: unknown source in checkpoint`);
  const scored = scoreV2Report(result.report, result.authoredContacts, contract, context.suite);
  return { score: scored.score, valid: scored.valid };
}

function decisionRunKey(run: DecisionRun): string {
  return `${run.sourceId}\0${run.budget}\0${run.seedSlot}\0${run.actualSeed}`;
}

export function assertQualificationSucceeded(
  run: Pick<SnapshotBenchmarkRun, "workerFailures">,
): void {
  if (run.workerFailures > 0) {
    throw new Error(
      `qualification sidecar has ${run.workerFailures} worker failure(s); ` +
      `the attempt remains in flight and must be resumed before an accept can be recorded`,
    );
  }
}

function scoreIdenticalFraction(baseArchive: any, candidateArchive: any): number {
  const key = (row: any): string =>
    `${row.task.sourceId}\0${row.task.budget}\0${row.task.seedSlot}\0${row.task.actualSeed}`;
  const base = new Map(baseArchive.runs.map((row: any) => [key(row), row.score.score]));
  const identical = candidateArchive.runs
    .filter((row: any) => base.get(key(row)) === row.score.score).length;
  return candidateArchive.runs.length === 0 ? 0 : identical / candidateArchive.runs.length;
}

function assertEpochDisjointFromManifest(
  suite: SuiteManifest,
  schedule: ReturnType<typeof resolvedSeedSchedule>,
): void {
  const fixed = new Map<number, Set<number>>();
  for (const profileName of ["probe", "canonical"] as const) {
    const profile = suite.profiles[profileName];
    const manifestSchedule = resolvedSeedSchedule(suite, profileName, profile.budgets, profile.seeds_per_budget);
    for (const entry of manifestSchedule.byBudget) {
      const seeds = fixed.get(entry.budget) ?? new Set<number>();
      for (const seed of entry.actualSeeds) seeds.add(seed);
      fixed.set(entry.budget, seeds);
    }
  }
  for (const entry of schedule.byBudget) {
    const seeds = fixed.get(entry.budget);
    if (seeds !== undefined && entry.actualSeeds.some((seed) => seeds.has(seed))) {
      throw new Error(`${entry.budget}: the fresh eval epoch overlaps a fixed manifest schedule`);
    }
  }
}

function readEraStateIfPresent(argument: (name: string) => string | undefined): EraState | null {
  const paths = attemptPaths(argument);
  return existsSync(paths.ledger) ? readEraState(paths) : null;
}

function attemptPaths(argument: (name: string) => string | undefined): { ledger: string; projection: string } {
  return {
    ledger: resolve(argument("attempts-ledger") ?? "benchmark/v2/attempts.jsonl"),
    projection: resolve(argument("era-state") ?? "benchmark/v2/era-state.json"),
  };
}

function findDeclareEvent(era: EraState, ledgerPaths: { ledger: string; projection: string }): any {
  const events = readAttemptEventsFor(ledgerPaths, era.inFlightAttemptId!);
  const declare = events.find((event) => event.type === "declare");
  if (declare === undefined) throw new Error(`in-flight attempt has no declare event; the ledger is corrupt`);
  return declare;
}

function readAttemptEventsFor(
  ledgerPaths: { ledger: string; projection: string },
  attemptId: string,
): any[] {
  if (!existsSync(ledgerPaths.ledger)) return [];
  return readFileSync(ledgerPaths.ledger, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line))
    .filter((event) => event.attemptId === attemptId);
}

function parseEvalMode(raw: string | undefined): ConfirmationMode {
  const mode = raw ?? "improve";
  if (mode === "improve" || mode === "improvement") return "improvement";
  if (mode === "simplify" || mode === "simplification") return "simplification";
  throw new Error(`--mode must be improve or simplify`);
}

function parseEvalMargin(mode: ConfirmationMode, raw: string | undefined): number | null {
  if (mode === "improvement") {
    if (raw !== undefined) throw new Error(`--margin is only valid with --mode=simplify`);
    return null;
  }
  const margin = Number(raw);
  if (!Number.isFinite(margin) || margin <= 0) {
    throw new Error(`--mode=simplify requires --margin=<positive headline points>`);
  }
  return margin;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
