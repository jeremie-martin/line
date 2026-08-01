/**
 * Multi-budget structural-law study for compile-budget telemetry.
 *
 * Phase 1 measurement only. Nothing here writes a runtime artifact, changes
 * policy, or edits the frozen calibrator/recorder/estimator. It answers one
 * question: does first-completion / remaining-work cost scale with the policy
 * budget in a way a scale-free law `ref * (B / refB)^alpha` can carry, and does
 * that law beat both incumbents on a budget it was never fitted at?
 *
 *   extract  compress one scale_study panel into per-compile records
 *   fit      fit per-budget coefficients, the law, and all holdouts
 *
 *   npx tsx scripts/v0/study_budget_law.ts extract \
 *     --panel=generated/budget-telemetry/law/panel-150k.json \
 *     --out=generated/budget-telemetry/law/compiles-150k.json
 *
 *   npx tsx scripts/v0/study_budget_law.ts fit \
 *     --analysis=generated/budget-telemetry/law/panel-150k.analysis.json \
 *     --analysis=... \
 *     --compiles=generated/budget-telemetry/law/compiles-150k.json --compiles=... \
 *     --edge=music2m:generated/budget-telemetry/music2m.analysis.json \
 *     --out=generated/budget-telemetry/law/budget-law.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { TRAVERSAL_BUDGET_MODEL_V1 } from "./optimizer/budget_model.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  budgetEstimatorStructuralScale,
} from "./optimizer/budget_estimator.ts";

/** Anchor budget of the shipped artifact; the law's reference point. */
const REFERENCE_BUDGET = 750_000;
/** Attempt kinds the frozen calibrator admits as fit evidence. */
const FITTED_KINDS = new Set(["initial", "snapshot", "repair"]);
const FAMILY_FOLDS = 5;
const SEED_FOLDS = 4;

type Structural = { interceptFrames: number; contactFrames: number; durationFrameScale: number };

type Sample = {
  source: string;
  context: string;
  group: string;
  attemptKind: string;
  attemptId: number;
  event: string;
  actual: number;
  structural: number;
  path: number | null;
  pace: number | null;
  combined: number;
  lower: number;
  upper: number;
  remainingContacts: number;
  remainingDurationFrames: number;
  startupIncluded: boolean;
  progressFraction: number;
  policyBudgetFrames: number;
  estimatorApplicability: string;
};

type Row = Sample & {
  budget: number;
  seed: number | null;
  weight: number;
  familyFold: number;
  seedFold: number;
  /** Design row: startup indicator, remaining contacts, remaining authored frames. */
  x: [number, number, number];
};

type CompileRecord = {
  sourceId: string;
  family: string;
  seed: number;
  budget: number;
  policyBudget: number;
  hardBudget: number;
  totalSpent: number;
  hardOverrun: number;
  budgetExhausted: boolean;
  anchorContacts: number;
  anchorDurationFrames: number;
  anchorGaps: number;
  firstTerminalTotalSpentFrames: number | null;
  initialCompleted: boolean;
  attemptsByKind: Record<string, number>;
  censoredAttempts: number;
  score: number | null;
  valid: boolean;
  status: string;
};

const argv = process.argv.slice(2);
const verb = argv[0];
const values = (name: string): string[] => {
  const prefix = `--${name}=`;
  return argv.filter((value) => value.startsWith(prefix)).map((value) => value.slice(prefix.length));
};
const value = (name: string): string | undefined => values(name)[0];

if (verb === "extract") extract();
else if (verb === "fit") fit();
else throw new Error("usage: study_budget_law.ts <extract|fit> ...");

// ---------------------------------------------------------------- extract ---

function extract(): void {
  const panelPath = value("panel");
  const outPath = value("out");
  if (panelPath === undefined || outPath === undefined) {
    throw new Error("extract requires --panel=<panel.json> --out=<compiles.json>");
  }
  const panel = readJson(resolve(panelPath));
  const records: CompileRecord[] = [];
  for (const run of panel.runs ?? []) {
    const telemetry = run.budgetTelemetry;
    if (telemetry === null || telemetry === undefined) continue;
    const attempts = telemetry.attempts ?? [];
    const initial = attempts.find((attempt: any) => attempt.kind === "initial");
    const attemptsByKind: Record<string, number> = {};
    for (const attempt of attempts) {
      attemptsByKind[attempt.kind] = (attemptsByKind[attempt.kind] ?? 0) + 1;
    }
    records.push({
      sourceId: run.task.sourceId,
      family: run.source.originFamily,
      seed: run.task.actualSeed,
      budget: run.task.budget,
      policyBudget: telemetry.compile.policy_budget_frames,
      hardBudget: telemetry.compile.hard_budget_frames,
      totalSpent: telemetry.compile.total_spent_frames,
      hardOverrun: telemetry.compile.hard_overrun_frames,
      budgetExhausted: telemetry.compile.budget_exhausted,
      anchorContacts: initial?.anchor.remaining_contacts ?? 0,
      anchorDurationFrames: initial?.anchor.remaining_duration_frames ?? 0,
      anchorGaps: initial?.anchor.remaining_gaps ?? 0,
      firstTerminalTotalSpentFrames: telemetry.compile.first_terminal_total_spent_frames ?? null,
      initialCompleted: initial?.outcome.completed === true,
      attemptsByKind,
      censoredAttempts: attempts.filter((attempt: any) => attempt.outcome.censored).length,
      score: run.score?.score ?? null,
      valid: run.score?.valid === true,
      status: run.status,
    });
  }
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(resolve(outPath), `${JSON.stringify({
    schema: "line.budget-law-compiles.v1",
    panel: panelPath,
    compiles: records,
  })}\n`);
  const completed = records.filter((record) => record.firstTerminalTotalSpentFrames !== null).length;
  console.log(
    `${panelPath}: ${records.length} compiles; ${completed} reached a first terminal; ` +
      `${records.length - completed} censored`,
  );
}

// -------------------------------------------------------------------- fit ---

function fit(): void {
  const analysisPaths = values("analysis");
  if (analysisPaths.length < 2) throw new Error("fit requires at least two --analysis= inputs");
  const compilePaths = values("compiles");
  const edgeSpecs = values("edge");
  const outPath = resolve(value("out") ?? "generated/budget-telemetry/law/budget-law.json");

  const rows: Row[] = [];
  const analyses: Array<Record<string, unknown>> = [];
  for (const path of analysisPaths) {
    const analysis = readJson(resolve(path));
    if (analysis.schema !== "line.compile-budget-telemetry-analysis.v1") {
      throw new Error(`${path}: expected line.compile-budget-telemetry-analysis.v1`);
    }
    analyses.push(summarizeAnalysis(path, analysis));
    for (const sample of analysis.calibration_samples as Sample[]) rows.push(prepare(sample));
  }
  assignWeights(rows);
  const budgets = [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b);
  const families = [...new Set(rows.map((row) => row.group))].sort();
  const seeds = [...new Set(rows.map((row) => row.seed).filter((seed): seed is number => seed !== null))]
    .sort((a, b) => a - b);
  const familyFold = foldMap(families, Math.min(FAMILY_FOLDS, families.length));
  const seedFold = foldMap(seeds.map(String), Math.min(SEED_FOLDS, seeds.length));
  for (const row of rows) {
    row.familyFold = familyFold.get(row.group)!;
    row.seedFold = row.seed === null ? 0 : seedFold.get(String(row.seed))!;
  }
  if (rows.some((row) => row.seed === null)) {
    throw new Error("every panel sample must carry a recoverable seed for double-blocked folds");
  }

  const compiles: CompileRecord[] = compilePaths.flatMap((path) =>
    readJson(resolve(path)).compiles as CompileRecord[]
  );

  // Two populations, two questions. The first-completion view is the quantity
  // TRAVERSAL_BUDGET_MODEL_V1 predicts and budget_slack divides by; the
  // calibrator view is the remaining-work question the frozen artifact fits.
  const firstCompletion = rows.filter((row) => row.attemptKind === "initial" && row.event === "start");
  const calibrator = rows.filter((row) => FITTED_KINDS.has(row.attemptKind));
  const pathFree = calibrator.filter((row) => !hasPath(row));

  const views = [
    { id: "first_completion", label: "initial attempt starts (first-completion cost)", rows: firstCompletion, unitWeights: true },
    { id: "calibrator", label: "calibrator population (initial+snapshot+repair, attempt-weighted)", rows: calibrator, unitWeights: false },
    { id: "path_free", label: "path-free observations only (the artifact's structural domain)", rows: pathFree, unitWeights: false },
  ] as const;

  const perBudget = views.map((view) => {
    const fits = budgets.map((budget) => {
      const selected = view.rows.filter((row) => row.budget === budget);
      const weights = view.unitWeights ? unit(selected) : selected;
      const coefficients = fitStructural(weights);
      const jackknife = jackknifeStructural(weights, families);
      return {
        budget,
        n: selected.length,
        attempts: new Set(selected.map(attemptKey)).size,
        coefficients: rounded(coefficients),
        jackknifeStdError: rounded(jackknife),
        selfError: errorSummary(weights.map((row) => ({ row, predicted: structuralPredict(coefficients, row) }))),
      };
    });
    const anchor = fits.find((entry) => entry.budget === REFERENCE_BUDGET)?.coefficients;
    return {
      view: view.id,
      label: view.label,
      budgets: fits.map((entry) => ({
        ...entry,
        ratioToReference: anchor === undefined ? null : {
          interceptFrames: round(entry.coefficients.interceptFrames / Math.max(1e-9, anchor.interceptFrames), 3),
          contactFrames: round(entry.coefficients.contactFrames / Math.max(1e-9, anchor.contactFrames), 3),
          durationFrameScale: round(entry.coefficients.durationFrameScale / Math.max(1e-9, anchor.durationFrameScale), 3),
        },
      })),
    };
  });

  // Balanced panel: only (source, seed) cells whose initial attempt completed at
  // every budget. If the coefficients still move across budgets here, the
  // movement is policy scaling and not survivorship at the scarce budgets.
  const cellBudgets = new Map<string, Set<number>>();
  for (const row of firstCompletion) {
    const key = `${row.context.split("/")[0]} ${row.seed}`;
    if (!cellBudgets.has(key)) cellBudgets.set(key, new Set());
    cellBudgets.get(key)!.add(row.budget);
  }
  const balancedKeys = new Set([...cellBudgets]
    .filter(([, seen]) => budgets.every((budget) => seen.has(budget)))
    .map(([key]) => key));
  const balanced = firstCompletion.filter((row) =>
    balancedKeys.has(`${row.context.split("/")[0]} ${row.seed}`)
  );
  const balancedReferenceCost = median(balanced.filter((row) => row.budget === REFERENCE_BUDGET)
    .map((row) => row.actual));
  const balancedCost = (budget: number): number =>
    median(balanced.filter((row) => row.budget === budget).map((row) => row.actual));
  // Consecutive-pair exponents. A constant alpha is only credible if the pairs
  // agree; a drift would say the law is a local linearization, not a law.
  const pairwiseAlpha = budgets.slice(1).map((budget, index) => {
    const previous = budgets[index];
    return {
      from: previous,
      to: budget,
      costRatio: round(balancedCost(budget) / balancedCost(previous), 4),
      impliedAlpha: round(
        Math.log(balancedCost(budget) / balancedCost(previous)) / Math.log(budget / previous),
        4,
      ),
    };
  });
  const balancedByBudget = budgets.map((budget) => {
    const selected = unit(balanced.filter((row) => row.budget === budget));
    const coefficients = fitStructural(selected);
    const cost = median(selected.map((row) => row.actual));
    const scale = budget / REFERENCE_BUDGET;
    // Paired within-cell ratio: the same spec+seed at this budget over its own
    // 750k cost. Free of the composition effects a median-of-medians can hide.
    const pairedRatios = selected.map((row) => {
      const key = `${row.context.split("/")[0]} ${row.seed}`;
      const anchor = balanced.find((other) =>
        other.budget === REFERENCE_BUDGET && `${other.context.split("/")[0]} ${other.seed}` === key
      );
      return anchor === undefined ? null : row.actual / anchor.actual;
    }).filter((entry): entry is number => entry !== null);
    return {
      budget,
      n: selected.length,
      coefficients: rounded(coefficients),
      jackknifeStdError: rounded(jackknifeStructural(selected, families)),
      medianFirstCompletionCost: round(cost),
      costRatioToReference: round(cost / balancedReferenceCost, 4),
      medianPairedRatioToReference: round(percentile(pairedRatios, 0.5), 4),
      impliedAlpha: scale === 1 ? null
        : round(Math.log(percentile(pairedRatios, 0.5)!) / Math.log(scale), 4),
    };
  });

  // Census of censoring: a compile with no first terminal contributes no sample
  // at all, so the fit above is conditioned on completing. Edge budgets appear
  // here too, since a compile record is all these rows need.
  const compileBudgets = [...new Set(compiles.map((record) => record.budget))].sort((a, b) => a - b);
  const censoring = compileBudgets.map((budget) => {
    const selected = compiles.filter((record) => record.budget === budget);
    const completed = selected.filter((record) => record.firstTerminalTotalSpentFrames !== null);
    const costs = completed.map((record) => record.firstTerminalTotalSpentFrames!).sort((a, b) => a - b);
    return {
      budget,
      compiles: selected.length,
      reachedFirstTerminal: completed.length,
      censoredCompiles: selected.length - completed.length,
      censoredCompileRate: ratio(selected.length - completed.length, selected.length),
      censoredCells: selected.filter((record) => record.firstTerminalTotalSpentFrames === null)
        .map((record) => `${record.sourceId}/seed=${record.seed}`).sort(),
      invalidRuns: selected.filter((record) => !record.valid).length,
      budgetExhausted: selected.filter((record) => record.budgetExhausted).length,
      firstCompletionCost: quantiles(costs),
      firstCompletionCostShareOfBudget: costs.length === 0 ? null : round(median(costs) / budget, 4),
      repairAttempts: sum(selected.map((record) => record.attemptsByKind.repair ?? 0)),
      resumedAttempts: sum(selected.map((record) => record.attemptsByKind.resumed ?? 0)),
      chargedFrames: sum(selected.map((record) => record.totalSpent)),
    };
  });

  // Component accuracy by budget, straight off the recorded telemetry: this is
  // how each incumbent errs where it is actually read.
  const componentsByBudget = budgets.map((budget) => {
    const selected = rows.filter((row) => row.budget === budget);
    const initialStarts = selected.filter((row) => row.attemptKind === "initial" && row.event === "start");
    return {
      budget,
      samples: selected.length,
      recorded: {
        combined: errorSummary(selected.map((row) => ({ row, predicted: row.combined }))),
        structural: errorSummary(selected.map((row) => ({ row, predicted: row.structural }))),
        path: errorSummary(selected.filter(hasPath).map((row) => ({ row, predicted: row.path! }))),
        pace: errorSummary(selected.filter((row) => row.pace !== null && row.pace > 0)
          .map((row) => ({ row, predicted: row.pace! }))),
      },
      firstCompletion: {
        v1: errorSummary(unit(initialStarts).map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
        artifact: errorSummary(unit(initialStarts).map((row) => ({ row, predicted: artifactPredict(row) }))),
      },
      applicability: tally(selected.map((row) => row.estimatorApplicability)),
      intervalCoverage: ratio(
        selected.filter((row) => row.actual >= row.lower && row.actual <= row.upper).length,
        selected.length,
      ),
    };
  });

  // ------------------------------------------------------------- the law ---

  const lawViews = views.map((view) => {
    const population = view.unitWeights ? unit(view.rows) : view.rows;
    const shared = fitLaw(population, "shared");
    const perCoefficient = fitLaw(population, "per_coefficient");
    const slackForm = fitLogLaw(population, shared.reference);
    // Is the exponent one number or fourteen? A per-family refit answers that
    // directly; the jackknife turns the same refits into an uncertainty on the
    // pooled value.
    const familyAlphas = families
      .filter((family) => new Set(population.filter((row) => row.group === family).map((row) => row.budget)).size >= 3)
      .map((family) => ({
        family,
        alpha: fitLaw(population.filter((row) => row.group === family), "shared").alpha[1],
      }));
    const jackknifeAlphas = families.map((family) =>
      fitLaw(population.filter((row) => row.group !== family), "shared").alpha[1]
    );
    const jackknifeMean = jackknifeAlphas.reduce((total, entry) => total + entry, 0) / jackknifeAlphas.length;
    return {
      view: view.id,
      label: view.label,
      shared: describeLaw(shared),
      perCoefficient: describeLaw(perCoefficient),
      slackForm: describeLogLaw(slackForm),
      alphaByFamily: familyAlphas,
      alphaSpreadAcrossFamilies: {
        min: round(Math.min(...familyAlphas.map((entry) => entry.alpha)), 4),
        max: round(Math.max(...familyAlphas.map((entry) => entry.alpha)), 4),
      },
      alphaJackknifeStdError: round(Math.sqrt(
        ((families.length - 1) / families.length) *
        jackknifeAlphas.reduce((total, entry) => total + (entry - jackknifeMean) ** 2, 0),
      ), 4),
      slackDependence: slackDependence(population, shared),
      budgetTransfer: budgets.map((heldOut) => {
        const train = population.filter((row) => row.budget !== heldOut);
        const test = population.filter((row) => row.budget === heldOut);
        const sharedFit = fitLaw(train, "shared");
        const perFit = fitLaw(train, "per_coefficient");
        // Same training rows, no budget term. The honest control for "did the
        // exponent buy anything, or just a refreshed anchor on this corpus?"
        const pooledConstant = fitStructural(train);
        const slackFit = fitLogLaw(train, sharedFit.reference);
        return {
          heldOutBudget: heldOut,
          testSamples: test.length,
          fittedBudgets: [...new Set(train.map((row) => row.budget))].sort((a, b) => a - b),
          shared: { law: describeLaw(sharedFit), error: errorSummary(predictLaw(test, sharedFit)) },
          perCoefficient: { law: describeLaw(perFit), error: errorSummary(predictLaw(test, perFit)) },
          slackForm: {
            law: describeLogLaw(slackFit),
            error: errorSummary(test.map((row) => ({ row, predicted: logLawPredict(slackFit, row) }))),
          },
          incumbentV1: errorSummary(test.map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
          incumbentArtifact: errorSummary(test.map((row) => ({ row, predicted: artifactPredict(row) }))),
          constantPooled: {
            coefficients: rounded(pooledConstant),
            error: errorSummary(test.map((row) => ({ row, predicted: structuralPredict(pooledConstant, row) }))),
          },
        };
      }),
      doubleBlocked: doubleBlockedHoldout(population, budgets),
    };
  });

  // ------------------------------------------------------------ the edges ---

  const primaryLaw = fitLaw(unit(firstCompletion), "shared");
  const primaryLawPer = fitLaw(unit(firstCompletion), "per_coefficient");
  const primarySlack = fitLogLaw(unit(firstCompletion), primaryLaw.reference);
  const calibratorLaw = fitLaw(calibrator, "shared");
  const calibratorSlack = fitLogLaw(calibrator, calibratorLaw.reference);
  const edges = edgeSpecs.map((spec) => {
    const split = spec.indexOf(":");
    const label = split < 0 ? spec : spec.slice(0, split);
    const path = split < 0 ? spec : spec.slice(split + 1);
    const analysis = readJson(resolve(path));
    const edgeRows = (analysis.calibration_samples as Sample[]).map(prepare);
    assignWeights(edgeRows);
    const initialStarts = unit(edgeRows.filter((row) => row.attemptKind === "initial" && row.event === "start"));
    const fitted = edgeRows.filter((row) => FITTED_KINDS.has(row.attemptKind));
    return {
      label,
      input: path,
      policyBudgets: [...new Set(edgeRows.map((row) => row.budget))].sort((a, b) => a - b),
      samples: edgeRows.length,
      extrapolationFactor: round(
        Math.max(...edgeRows.map((row) => row.budget)) / REFERENCE_BUDGET,
        3,
      ),
      firstCompletion: {
        n: initialStarts.length,
        law_shared: errorSummary(predictLaw(initialStarts, primaryLaw)),
        law_per_coefficient: errorSummary(predictLaw(initialStarts, primaryLawPer)),
        law_slack_form: errorSummary(initialStarts.map((row) => ({ row, predicted: logLawPredict(primarySlack, row) }))),
        incumbentV1: errorSummary(initialStarts.map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
        incumbentArtifact: errorSummary(initialStarts.map((row) => ({ row, predicted: artifactPredict(row) }))),
        rows: initialStarts.map((row) => ({
          source: row.source.split("/").at(-1),
          contacts: row.remainingContacts,
          durationFrames: row.remainingDurationFrames,
          budget: row.budget,
          actual: row.actual,
          law_shared: round(lawPredict(primaryLaw, row)),
          v1: round(structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row)),
          artifact: round(artifactPredict(row)),
        })),
      },
      allFittedKinds: {
        n: fitted.length,
        law_shared: errorSummary(predictLaw(fitted, calibratorLaw)),
        law_slack_form: errorSummary(fitted.map((row) => ({ row, predicted: logLawPredict(calibratorSlack, row) }))),
        incumbentV1: errorSummary(fitted.map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
        incumbentArtifact: errorSummary(fitted.map((row) => ({ row, predicted: artifactPredict(row) }))),
        recordedCombined: errorSummary(fitted.map((row) => ({ row, predicted: row.combined }))),
        recordedPace: errorSummary(fitted.filter((row) => row.pace !== null && row.pace > 0)
          .map((row) => ({ row, predicted: row.pace! }))),
      },
    };
  });

  /*
   * The censored cells are invisible to every fit above, so the only honest
   * test on them is a classification one: does the law, fitted WITHOUT this
   * budget, say the compile could not have finished inside it? A model that
   * only predicts the cost of searches that finished is not a budget model.
   */
  const censoredFeasibility = compileBudgets.map((budget) => {
    const law = fitLaw(unit(firstCompletion.filter((row) => row.budget !== budget)), "shared");
    const asRow = (record: CompileRecord): Row => ({
      budget,
      x: [1, record.anchorContacts, record.anchorDurationFrames],
    } as Row);
    const screen = (records: CompileRecord[]) => ({
      n: records.length,
      flaggedInfeasible: records.filter((record) => lawPredict(law, asRow(record)) > budget).length,
      medianPredicted: round(median(records.map((record) => lawPredict(law, asRow(record))))),
      medianPredictedOverBudget: round(median(records.map((record) => lawPredict(law, asRow(record)) / budget)), 4),
    });
    const selected = compiles.filter((record) => record.budget === budget);
    const v1Screen = (records: CompileRecord[]) =>
      records.filter((record) => structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, asRow(record)) > budget).length;
    return {
      budget,
      law: describeLaw(law),
      censored: { ...screen(selected.filter((record) => record.firstTerminalTotalSpentFrames === null)),
        v1FlaggedInfeasible: v1Screen(selected.filter((record) => record.firstTerminalTotalSpentFrames === null)) },
      completed: { ...screen(selected.filter((record) => record.firstTerminalTotalSpentFrames !== null)),
        v1FlaggedInfeasible: v1Screen(selected.filter((record) => record.firstTerminalTotalSpentFrames !== null)) },
    };
  });

  /*
   * What a naive swap would do to the live slack coordinate.
   *
   * `budget_slack = policy budget / predicted first completion` and its
   * consumers are thresholds and smoothsteps around slack ~1-2
   * (`HANDOFF_LOW_SLACK_BRANCH_THRESHOLD` is 1.5 in handoff.ts). V1's predictor
   * is budget-independent, so slack today is proportional to the budget. A
   * budget-dependent predictor with exponent alpha makes slack proportional to
   * `B^(1-alpha)`, which at alpha = 0.82 is nearly flat. That is not a tuning
   * detail; it is the whole signal the ramps ride on.
   */
  const lowSlackThreshold = 1.5;
  const policyImpact = compileBudgets.map((budget) => {
    const selected = compiles.filter((record) => record.budget === budget);
    const asRow = (record: CompileRecord): Row => ({
      budget,
      x: [1, record.anchorContacts, record.anchorDurationFrames],
    } as Row);
    const v1Slack = selected.map((record) => budget / structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, asRow(record)));
    const lawSlack = selected.map((record) => budget / lawPredict(primaryLaw, asRow(record)));
    const measuredSlack = selected.filter((record) => record.firstTerminalTotalSpentFrames !== null)
      .map((record) => budget / record.firstTerminalTotalSpentFrames!);
    return {
      budget,
      medianV1Slack: round(percentile(v1Slack, 0.5), 3),
      medianLawSlack: round(percentile(lawSlack, 0.5), 3),
      medianMeasuredSlack: round(percentile(measuredSlack, 0.5), 3),
      belowLowSlackThresholdV1: v1Slack.filter((slack) => slack < lowSlackThreshold).length,
      belowLowSlackThresholdLaw: lawSlack.filter((slack) => slack < lowSlackThreshold).length,
      compiles: selected.length,
    };
  });

  const report = {
    schema: "line.budget-law-study.v1",
    generatedAt: new Date().toISOString(),
    referenceBudget: REFERENCE_BUDGET,
    inputs: { analyses: analysisPaths, compiles: compilePaths, edges: edgeSpecs },
    panel: {
      budgets,
      families,
      seeds,
      samples: rows.length,
      attempts: new Set(rows.map(attemptKey)).size,
      compiles: compiles.length,
      chargedFrames: sum(compiles.map((record) => record.totalSpent)),
      familyFold: Object.fromEntries(families.map((family) => [family, familyFold.get(family)!])),
      seedFold: Object.fromEntries(seeds.map((seed) => [seed, seedFold.get(String(seed))!])),
    },
    analyses,
    incumbents: {
      v1: TRAVERSAL_BUDGET_MODEL_V1,
      artifact: { modelId: BUDGET_ESTIMATOR_MODEL.modelId, ...BUDGET_ESTIMATOR_MODEL.structural },
    },
    perBudgetCoefficients: perBudget,
    balancedPanel: {
      cells: balancedKeys.size,
      totalCells: cellBudgets.size,
      byBudget: balancedByBudget,
      pairwiseAlpha,
    },
    censoring,
    censoredFeasibility,
    policyImpact,
    componentsByBudget,
    law: lawViews,
    edges,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  const markdownOut = extname(outPath) === ".json" ? `${outPath.slice(0, -5)}.md` : `${outPath}.md`;
  writeFileSync(markdownOut, markdown(report));
  console.log(markdown(report));
  console.log(`wrote ${outPath} and ${markdownOut}`);
}

// ------------------------------------------------------------------ model ---

type Law = {
  form: "shared" | "per_coefficient";
  reference: Structural;
  alpha: [number, number, number];
  sse: number;
  n: number;
};

/**
 * Aggregated normal equations, one block per budget.
 *
 * `s^alpha` depends only on the budget, so the weighted normal equations for
 * any exponent vector are exact sums of four precomputed 3x3 blocks. That turns
 * the exponent search from O(grid * samples) into O(grid), which is what makes
 * a fine grid and every holdout refit affordable.
 */
type Blocks = Array<{ scale: number; matrix: number[][]; vector: number[]; qq: number; weight: number; n: number }>;

function blocksOf(rows: Row[]): Blocks {
  const byBudget = new Map<number, Row[]>();
  for (const row of rows) {
    if (!byBudget.has(row.budget)) byBudget.set(row.budget, []);
    byBudget.get(row.budget)!.push(row);
  }
  return [...byBudget.entries()].sort((a, b) => a[0] - b[0]).map(([budget, selected]) => {
    const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const vector = [0, 0, 0];
    let qq = 0;
    let weight = 0;
    for (const row of selected) {
      weight += row.weight;
      qq += row.weight * row.actual * row.actual;
      for (let j = 0; j < 3; j++) {
        vector[j] += row.weight * row.x[j] * row.actual;
        for (let k = 0; k < 3; k++) matrix[j][k] += row.weight * row.x[j] * row.x[k];
      }
    }
    return { scale: budget / REFERENCE_BUDGET, matrix, vector, qq, weight, n: selected.length };
  });
}

function solveAt(blocks: Blocks, alpha: [number, number, number]): { coefficients: number[]; sse: number } {
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const vector = [0, 0, 0];
  let qq = 0;
  for (const block of blocks) {
    qq += block.qq;
    const powers = alpha.map((exponent) => Math.pow(block.scale, exponent));
    for (let j = 0; j < 3; j++) {
      vector[j] += powers[j] * block.vector[j];
      for (let k = 0; k < 3; k++) matrix[j][k] += powers[j] * powers[k] * block.matrix[j][k];
    }
  }
  // Non-negative least squares by active-set enumeration: with three features
  // the seven non-empty supports are cheap and exact, which is what the frozen
  // calibrator does too.
  let best = { coefficients: [0, 0, 0], sse: Infinity };
  for (let mask = 1; mask < 8; mask++) {
    const active = [0, 1, 2].filter((index) => (mask & (1 << index)) !== 0);
    const sub = active.map((row) => active.map((column) => matrix[row][column]));
    const rhs = active.map((row) => vector[row]);
    const solved = solveLinearSystem(sub, rhs);
    if (solved === null || solved.some((entry) => entry < 0 || !Number.isFinite(entry))) continue;
    const coefficients = [0, 0, 0];
    active.forEach((index, position) => { coefficients[index] = solved[position]; });
    let sse = qq;
    for (let j = 0; j < 3; j++) {
      sse -= 2 * coefficients[j] * vector[j];
      for (let k = 0; k < 3; k++) sse += coefficients[j] * coefficients[k] * matrix[j][k];
    }
    if (sse < best.sse) best = { coefficients, sse };
  }
  return best;
}

function fitLaw(rows: Row[], form: Law["form"]): Law {
  const blocks = blocksOf(rows);
  let best: { alpha: [number, number, number]; coefficients: number[]; sse: number } | null = null;
  const consider = (alpha: [number, number, number]): void => {
    const solved = solveAt(blocks, alpha);
    if (best === null || solved.sse < best.sse) best = { alpha, coefficients: solved.coefficients, sse: solved.sse };
  };
  const grid = (lows: number[], highs: number[], step: number): void => {
    if (form === "shared") {
      for (let a = lows[0]; a <= highs[0] + 1e-9; a += step) consider([a, a, a]);
      return;
    }
    for (let a0 = lows[0]; a0 <= highs[0] + 1e-9; a0 += step) {
      for (let a1 = lows[1]; a1 <= highs[1] + 1e-9; a1 += step) {
        for (let a2 = lows[2]; a2 <= highs[2] + 1e-9; a2 += step) consider([a0, a1, a2]);
      }
    }
  };
  grid([-0.6, -0.6, -0.6], [2.4, 2.4, 2.4], 0.05);
  const coarse = best!.alpha;
  grid(coarse.map((a) => a - 0.05), coarse.map((a) => a + 0.05), 0.005);
  const fine = best!.alpha;
  grid(fine.map((a) => a - 0.005), fine.map((a) => a + 0.005), 0.0005);
  return {
    form,
    reference: {
      interceptFrames: best!.coefficients[0],
      contactFrames: best!.coefficients[1],
      durationFrameScale: best!.coefficients[2],
    },
    alpha: best!.alpha.map((a) => Number(a.toFixed(4))) as [number, number, number],
    sse: best!.sse,
    n: rows.length,
  };
}

/**
 * The slack-normalized alternative, fitted in log space.
 *
 *   cost = k * difficulty^gamma * (B / refB)^alpha
 *
 * `difficulty` is the shared law's own reference shape, so `gamma = 1` reduces
 * exactly to that law and `gamma = 1 - alpha` is the pure slack form
 * `D * (B / D)^alpha`. One extra constant buys the answer to "does cost depend
 * on the budget, or on the budget relative to the spec's difficulty?" without
 * guessing which, and the fitted gamma says how far from either pole the
 * corpus actually sits.
 */
type LogLaw = { shape: Structural; logK: number; gamma: number; alpha: number; n: number };

function fitLogLaw(rows: Row[], shape: Structural): LogLaw {
  const matrix = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const vector = [0, 0, 0];
  for (const row of rows) {
    const features = [
      1,
      Math.log(Math.max(1, structuralPredict(shape, row))),
      Math.log(row.budget / REFERENCE_BUDGET),
    ];
    const target = Math.log(row.actual);
    for (let j = 0; j < 3; j++) {
      vector[j] += row.weight * features[j] * target;
      for (let k = 0; k < 3; k++) matrix[j][k] += row.weight * features[j] * features[k];
    }
  }
  const solved = solveLinearSystem(matrix, vector) ?? [0, 1, 0];
  return { shape, logK: solved[0], gamma: solved[1], alpha: solved[2], n: rows.length };
}

function logLawPredict(law: LogLaw, row: Row): number {
  return Math.max(1, Math.exp(
    law.logK +
    law.gamma * Math.log(Math.max(1, structuralPredict(law.shape, row))) +
    law.alpha * Math.log(row.budget / REFERENCE_BUDGET),
  ));
}

function describeLogLaw(law: LogLaw): Record<string, unknown> {
  return {
    form: "k * difficulty^gamma * scale^alpha",
    shape: rounded(law.shape),
    k: round(Math.exp(law.logK), 6),
    gamma: round(law.gamma, 4),
    alpha: round(law.alpha, 4),
    pureBudgetGamma: 1,
    pureSlackGamma: round(1 - law.alpha, 4),
    n: law.n,
  };
}

function lawPredict(law: Law, row: Row): number {
  const scale = row.budget / REFERENCE_BUDGET;
  return Math.max(1,
    law.reference.interceptFrames * Math.pow(scale, law.alpha[0]) * row.x[0] +
    law.reference.contactFrames * Math.pow(scale, law.alpha[1]) * row.x[1] +
    law.reference.durationFrameScale * Math.pow(scale, law.alpha[2]) * row.x[2]);
}

function predictLaw(rows: Row[], law: Law): Array<{ row: Row; predicted: number }> {
  return rows.map((row) => ({ row, predicted: lawPredict(law, row) }));
}

/**
 * The frozen artifact's own structural prediction for a row.
 *
 * Since schema v2 the artifact may carry a budget exponent, and reading its
 * three coefficients without the scale would report a model nobody ships. Ask
 * the runtime for the scalar rather than re-deriving it here; on a v1 artifact
 * it is exactly 1 and this is the plain coefficient prediction.
 */
function artifactPredict(row: Row): number {
  return budgetEstimatorStructuralScale(row.budget) *
    structuralPredict(BUDGET_ESTIMATOR_MODEL.structural, row);
}

function structuralPredict(model: Structural, row: Row): number {
  return Math.max(1,
    model.interceptFrames * row.x[0] +
    model.contactFrames * row.x[1] +
    model.durationFrameScale * row.x[2]);
}

function fitStructural(rows: Row[]): Structural {
  const solved = solveAt(blocksOf(rows).map((block) => ({ ...block, scale: 1 })), [0, 0, 0]);
  return {
    interceptFrames: solved.coefficients[0],
    contactFrames: solved.coefficients[1],
    durationFrameScale: solved.coefficients[2],
  };
}

/** Leave-one-family-out spread on each coefficient; the panel's own uncertainty. */
function jackknifeStructural(rows: Row[], families: string[]): Structural {
  const present = families.filter((family) => rows.some((row) => row.group === family));
  if (present.length < 3) return { interceptFrames: NaN, contactFrames: NaN, durationFrameScale: NaN };
  const fits = present.map((family) => fitStructural(rows.filter((row) => row.group !== family)));
  const scale = (present.length - 1) / present.length;
  const spread = (pick: (fit: Structural) => number): number => {
    const mean = fits.reduce((total, fit) => total + pick(fit), 0) / fits.length;
    return Math.sqrt(scale * fits.reduce((total, fit) => total + (pick(fit) - mean) ** 2, 0));
  };
  return {
    interceptFrames: spread((fit) => fit.interceptFrames),
    contactFrames: spread((fit) => fit.contactFrames),
    durationFrameScale: spread((fit) => fit.durationFrameScale),
  };
}

/**
 * Does the law need slack rather than raw budget?
 *
 * A shared exponent says cost/difficulty depends on `B` alone; a slack form
 * says it depends on `B / D`. The two differ by a `log D` term in the residual,
 * so regressing the law's log residual on `log D` measures the missing slack
 * exponent directly. A slope indistinguishable from zero means the slack form
 * has nothing to add and the simpler law stands.
 */
function slackDependence(rows: Row[], law: Law): { slope: number; intercept: number; n: number; note: string } {
  const points = rows.map((row) => {
    const predicted = lawPredict(law, row);
    const difficulty = structuralPredict(law.reference, row);
    return { x: Math.log(Math.max(1, difficulty)), y: Math.log(row.actual / predicted), weight: row.weight };
  });
  const total = points.reduce((accumulated, point) => accumulated + point.weight, 0);
  const meanX = points.reduce((accumulated, point) => accumulated + point.weight * point.x, 0) / total;
  const meanY = points.reduce((accumulated, point) => accumulated + point.weight * point.y, 0) / total;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += point.weight * (point.x - meanX) * (point.y - meanY);
    variance += point.weight * (point.x - meanX) ** 2;
  }
  const slope = variance === 0 ? 0 : covariance / variance;
  return {
    slope: roundNumber(slope, 4),
    intercept: roundNumber(meanY - slope * meanX, 4),
    n: points.length,
    note: "log residual on log difficulty; a slack form would need slope = -alpha",
  };
}

/** Every sample scored by a law that saw neither its family nor its seed. */
function doubleBlockedHoldout(rows: Row[], budgets: number[]): Record<string, unknown> {
  const familyFolds = Math.min(FAMILY_FOLDS, new Set(rows.map((row) => row.familyFold)).size);
  const seedFolds = Math.min(SEED_FOLDS, new Set(rows.map((row) => row.seedFold)).size);
  const shared: Array<{ row: Row; predicted: number }> = [];
  const perCoefficient: Array<{ row: Row; predicted: number }> = [];
  const slackForm: Array<{ row: Row; predicted: number }> = [];
  for (let family = 0; family < familyFolds; family++) {
    for (let seed = 0; seed < seedFolds; seed++) {
      const test = rows.filter((row) => row.familyFold === family && row.seedFold === seed);
      if (test.length === 0) continue;
      const train = rows.filter((row) => row.familyFold !== family && row.seedFold !== seed);
      const sharedLaw = fitLaw(train, "shared");
      const perLaw = fitLaw(train, "per_coefficient");
      const slackLaw = fitLogLaw(train, sharedLaw.reference);
      shared.push(...predictLaw(test, sharedLaw));
      perCoefficient.push(...predictLaw(test, perLaw));
      slackForm.push(...test.map((row) => ({ row, predicted: logLawPredict(slackLaw, row) })));
    }
  }
  const all = rows.map((row) => row);
  return {
    cells: familyFolds * seedFolds,
    shared: errorSummary(shared),
    perCoefficient: errorSummary(perCoefficient),
    slackForm: errorSummary(slackForm),
    incumbentV1: errorSummary(all.map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
    incumbentArtifact: errorSummary(all.map((row) => ({ row, predicted: artifactPredict(row) }))),
    byBudget: budgets.map((budget) => ({
      budget,
      shared: errorSummary(shared.filter(({ row }) => row.budget === budget)),
      perCoefficient: errorSummary(perCoefficient.filter(({ row }) => row.budget === budget)),
      slackForm: errorSummary(slackForm.filter(({ row }) => row.budget === budget)),
      incumbentV1: errorSummary(all.filter((row) => row.budget === budget)
        .map((row) => ({ row, predicted: structuralPredict(TRAVERSAL_BUDGET_MODEL_V1, row) }))),
      incumbentArtifact: errorSummary(all.filter((row) => row.budget === budget)
        .map((row) => ({ row, predicted: artifactPredict(row) }))),
    })),
  };
}

// ------------------------------------------------------------------ shared ---

function prepare(sample: Sample): Row {
  const startup = sample.startupIncluded ??
    (sample.attemptKind === "initial" && sample.progressFraction === 0);
  return {
    ...sample,
    startupIncluded: startup,
    budget: sample.policyBudgetFrames,
    seed: sampleSeed(sample),
    weight: 1,
    familyFold: 0,
    seedFold: 0,
    x: [startup ? 1 : 0, sample.remainingContacts, sample.remainingDurationFrames],
  };
}

function assignWeights(rows: Row[]): void {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(attemptKey(row), (counts.get(attemptKey(row)) ?? 0) + 1);
  for (const row of rows) row.weight = 1 / counts.get(attemptKey(row))!;
}

/** One row per observation, unweighted; used where each row is already one compile. */
function unit(rows: Row[]): Row[] {
  return rows.map((row) => ({ ...row, weight: 1 }));
}

function attemptKey(row: Sample): string {
  return `${row.source} ${row.context} ${row.attemptKind} ${row.attemptId}`;
}

function hasPath(row: Row): boolean {
  return row.path !== null && Number.isFinite(row.path) && row.path > 0;
}

function sampleSeed(sample: Sample): number | null {
  const parts = sample.context.split("/");
  for (const part of parts) {
    if (part.startsWith("seed=")) {
      const labelled = Number(part.slice(5));
      return Number.isSafeInteger(labelled) ? labelled : null;
    }
  }
  if (parts.length === 3) {
    const positional = Number(parts[1]);
    if (parts[1].length > 0 && Number.isSafeInteger(positional)) return positional;
  }
  return null;
}

function foldMap(keys: string[], folds: number): Map<string, number> {
  const ordered = [...keys].sort();
  return new Map(ordered.map((key, index) => [key, index % Math.max(1, folds)]));
}

type ErrorSummary = {
  n: number;
  weightedMedianAbsLogError: number | null;
  medianAbsolutePercentageError: number | null;
  p90AbsolutePercentageError: number | null;
  medianSignedPercentageError: number | null;
  weightedMeanAbsLogError: number | null;
  biasFrames: number | null;
  maeFrames: number | null;
};

function errorSummary(predictions: Array<{ row: Row; predicted: number }>): ErrorSummary {
  const usable = predictions.filter(({ predicted }) => Number.isFinite(predicted) && predicted > 0);
  if (usable.length === 0) {
    return {
      n: 0,
      weightedMedianAbsLogError: null,
      medianAbsolutePercentageError: null,
      p90AbsolutePercentageError: null,
      medianSignedPercentageError: null,
      weightedMeanAbsLogError: null,
      biasFrames: null,
      maeFrames: null,
    };
  }
  const logs = usable.map(({ row, predicted }) => ({
    value: Math.abs(Math.log(predicted / row.actual)),
    weight: row.weight,
  }));
  const apes = usable.map(({ row, predicted }) => Math.abs(predicted - row.actual) / row.actual);
  const signed = usable.map(({ row, predicted }) => (predicted - row.actual) / row.actual);
  const errors = usable.map(({ row, predicted }) => predicted - row.actual);
  const totalWeight = logs.reduce((total, entry) => total + entry.weight, 0);
  return {
    n: usable.length,
    weightedMedianAbsLogError: round(weightedPercentile(logs, 0.5), 4),
    medianAbsolutePercentageError: round(percentile(apes, 0.5), 4),
    p90AbsolutePercentageError: round(percentile(apes, 0.9), 4),
    medianSignedPercentageError: round(percentile(signed, 0.5), 4),
    weightedMeanAbsLogError: round(
      logs.reduce((total, entry) => total + entry.value * entry.weight, 0) / totalWeight,
      4,
    ),
    biasFrames: round(errors.reduce((total, entry) => total + entry, 0) / errors.length),
    maeFrames: round(errors.reduce((total, entry) => total + Math.abs(entry), 0) / errors.length),
  };
}

function describeLaw(law: Law): Record<string, unknown> {
  const zeroed = [law.reference.interceptFrames, law.reference.contactFrames, law.reference.durationFrameScale]
    .map((coefficient, index) => (coefficient === 0 ? ["intercept", "contact", "duration"][index] : null))
    .filter((name): name is string => name !== null);
  return {
    form: law.form,
    referenceBudget: REFERENCE_BUDGET,
    reference: rounded(law.reference),
    alpha: { intercept: law.alpha[0], contact: law.alpha[1], duration: law.alpha[2] },
    // An exponent on a zeroed coefficient means nothing, and one that ran to the
    // edge of the search means the corpus did not pin it down.
    unidentifiedExponents: zeroed,
    exponentAtSearchBound: law.alpha.some((exponent) => exponent < -0.55 || exponent > 2.35),
    n: law.n,
  };
}

function summarizeAnalysis(path: string, analysis: any): Record<string, unknown> {
  return {
    input: path,
    payloads: analysis.payloads,
    tracePayloads: analysis.trace_payloads,
    attempts: analysis.counts.attempts,
    completedAttempts: analysis.counts.completed_attempts,
    censoredAttempts: analysis.counts.censored_attempts,
    repairAttempts: analysis.counts.repair_attempts,
    samples: analysis.counts.exact_prediction_samples,
    chargedFrames: analysis.accounting.compile_frames,
    segmentedFrames: analysis.accounting.segment_frames,
    accountingViolations: analysis.accounting.violations,
    outOfDomainShare: analysis.out_of_domain_sample_share,
    calibratedIntervalCoverage: analysis.interval.coverage,
    estimatorFingerprint: analysis.estimators.corpus.map((entry: any) => entry.fingerprint.slice(0, 12)),
    matchesLocalEstimator: analysis.estimators.matches_local,
  };
}

function rounded(model: Structural): Structural {
  return {
    interceptFrames: roundNumber(model.interceptFrames, 3),
    contactFrames: roundNumber(model.contactFrames, 3),
    durationFrameScale: roundNumber(model.durationFrameScale, 3),
  };
}

/** Rounding that stays numeric; `round` widens to null for the report tables. */
function roundNumber(value: number, digits = 2): number {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : value;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-12) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const scale = augmented[column][column];
    for (let entry = column; entry <= size; entry++) augmented[column][entry] /= scale;
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let entry = column; entry <= size; entry++) {
        augmented[row][entry] -= factor * augmented[column][entry];
      }
    }
  }
  return augmented.map((row) => row[size]);
}

function readJson(path: string): any {
  const bytes = readFileSync(path);
  return JSON.parse(path.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8"));
}

function tally(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of values) counts[entry] = (counts[entry] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function quantiles(sorted: number[]): Record<string, number | null> {
  return {
    n: sorted.length,
    p10: round(percentile(sorted, 0.1)),
    median: round(percentile(sorted, 0.5)),
    p90: round(percentile(sorted, 0.9)),
    max: sorted.length === 0 ? null : sorted[sorted.length - 1],
  };
}

function median(values: number[]): number {
  return percentile([...values].sort((a, b) => a - b), 0.5) ?? 0;
}

function percentile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return sorted[low] * (1 - (index - low)) + sorted[high] * (index - low);
}

function weightedPercentile(values: Array<{ value: number; weight: number }>, probability: number): number {
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const target = probability * sorted.reduce((total, entry) => total + entry.weight, 0);
  let cumulative = 0;
  for (const entry of sorted) {
    cumulative += entry.weight;
    if (cumulative >= target) return entry.value;
  }
  return sorted[sorted.length - 1].value;
}

function sum(values: number[]): number {
  return values.reduce((total, entry) => total + entry, 0);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(6));
}

function round(value: number | null, digits = 2): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

// --------------------------------------------------------------- markdown ---

function markdown(report: any): string {
  const lines: string[] = [
    "# Budget Law Study",
    "",
    `Reference budget ${report.referenceBudget}; budgets ${report.panel.budgets.join(", ")}; ` +
      `${report.panel.families.length} families; seeds ${report.panel.seeds.join(",")}`,
    `${report.panel.compiles} compiles; ${report.panel.attempts} attempts; ` +
      `${report.panel.samples} samples; ${report.panel.chargedFrames.toLocaleString("en-US")} charged frames`,
    "",
    "## Panel Integrity",
    "",
    "| input | payloads | attempts | samples | violations | frames |",
    "|---|---:|---:|---:|---:|---:|",
    ...report.analyses.map((entry: any) =>
      `| ${entry.input} | ${entry.payloads} | ${entry.attempts} | ${entry.samples} | ` +
      `${entry.accountingViolations} | ${entry.chargedFrames} |`),
    "",
    "## Censoring And First-Completion Cost",
    "",
    "| budget | compiles | first terminal | censored | median cost | p90 | median/budget | repairs |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...report.censoring.map((entry: any) =>
      `| ${entry.budget} | ${entry.compiles} | ${entry.reachedFirstTerminal} | ` +
      `${entry.censoredCompiles} | ${entry.firstCompletionCost.median} | ${entry.firstCompletionCost.p90} | ` +
      `${entry.firstCompletionCostShareOfBudget} | ${entry.repairAttempts} |`),
  ];
  for (const view of report.perBudgetCoefficients) {
    lines.push(
      "",
      `## Per-Budget Coefficients: ${view.label}`,
      "",
      "| budget | n | intercept | +- | contact | +- | duration | +- |",
      "|---:|---:|---:|---:|---:|---:|---:|---:|",
      ...view.budgets.map((entry: any) =>
        `| ${entry.budget} | ${entry.n} | ${entry.coefficients.interceptFrames} | ${entry.jackknifeStdError.interceptFrames} | ` +
        `${entry.coefficients.contactFrames} | ${entry.jackknifeStdError.contactFrames} | ` +
        `${entry.coefficients.durationFrameScale} | ${entry.jackknifeStdError.durationFrameScale} |`),
    );
  }
  lines.push(
    "",
    "## Balanced Panel (cells completing at every budget)",
    "",
    `${report.balancedPanel.cells} of ${report.balancedPanel.totalCells} cells`,
    "",
    "| budget | n | intercept | contact | duration | median cost | paired ratio vs 750k | implied alpha |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...report.balancedPanel.byBudget.map((entry: any) =>
      `| ${entry.budget} | ${entry.n} | ${entry.coefficients.interceptFrames} | ` +
      `${entry.coefficients.contactFrames} | ${entry.coefficients.durationFrameScale} | ` +
      `${entry.medianFirstCompletionCost} | ${entry.medianPairedRatioToReference} | ${entry.impliedAlpha} |`),
    "",
    "Consecutive-pair exponents: " + report.balancedPanel.pairwiseAlpha
      .map((entry: any) => `${entry.from}->${entry.to} ${entry.impliedAlpha}`).join("; "),
    "",
    "## Censored-Cell Feasibility Screen (law fitted without the scored budget)",
    "",
    "| budget | censored n | flagged | median pred/budget | completed n | false alarms | V1 flags (cens/comp) |",
    "|---:|---:|---:|---:|---:|---:|---:|",
    ...report.censoredFeasibility.map((entry: any) =>
      `| ${entry.budget} | ${entry.censored.n} | ${entry.censored.flaggedInfeasible} | ` +
      `${entry.censored.medianPredictedOverBudget} | ${entry.completed.n} | ` +
      `${entry.completed.flaggedInfeasible} | ${entry.censored.v1FlaggedInfeasible}/${entry.completed.v1FlaggedInfeasible} |`),
    "",
    "## Live Slack Coordinate Under Each Predictor",
    "",
    "| budget | median V1 slack | median law slack | median measured slack | below 1.5 (V1) | below 1.5 (law) |",
    "|---:|---:|---:|---:|---:|---:|",
    ...report.policyImpact.map((entry: any) =>
      `| ${entry.budget} | ${entry.medianV1Slack} | ${entry.medianLawSlack} | ${entry.medianMeasuredSlack} | ` +
      `${entry.belowLowSlackThresholdV1}/${entry.compiles} | ${entry.belowLowSlackThresholdLaw}/${entry.compiles} |`),
    "",
    "## Recorded Component Accuracy By Budget",
    "",
    "| budget | samples | structural | combined | path | pace | V1 on first completion | artifact on first completion |",
    "|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...report.componentsByBudget.map((entry: any) =>
      `| ${entry.budget} | ${entry.samples} | ${signedPct(entry.recorded.structural)} | ` +
      `${signedPct(entry.recorded.combined)} | ${signedPct(entry.recorded.path)} | ` +
      `${signedPct(entry.recorded.pace)} | ${signedPct(entry.firstCompletion.v1)} | ` +
      `${signedPct(entry.firstCompletion.artifact)} |`),
    "",
    "Cells are `median APE (median signed error)`; a positive signed error is overprediction.",
  );
  for (const view of report.law) {
    lines.push(
      "",
      `## Law: ${view.label}`,
      "",
      `shared exponent ${view.shared.alpha.contact}; reference ` +
        `${JSON.stringify(view.shared.reference)}`,
      `per-coefficient exponents ${JSON.stringify(view.perCoefficient.alpha)}; reference ` +
        `${JSON.stringify(view.perCoefficient.reference)}`,
      `slack form gamma ${view.slackForm.gamma} (pure budget 1, pure slack ${view.slackForm.pureSlackGamma}), ` +
        `alpha ${view.slackForm.alpha}; residual-on-difficulty slope ${view.slackDependence.slope}`,
      `alpha family jackknife SE ${view.alphaJackknifeStdError}; per-family alpha range ` +
        `${view.alphaSpreadAcrossFamilies.min} to ${view.alphaSpreadAcrossFamilies.max}`,
      "",
      "### Budget-transfer holdout (fit three budgets, predict the fourth)",
      "",
      "| held-out | n | fitted alpha | law shared | law per-coef | slack form | pooled constant | V1 | artifact |",
      "|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
      ...view.budgetTransfer.map((entry: any) =>
        `| ${entry.heldOutBudget} | ${entry.testSamples} | ${entry.shared.law.alpha.contact} | ` +
        `${pct(entry.shared.error.medianAbsolutePercentageError)} | ` +
        `${pct(entry.perCoefficient.error.medianAbsolutePercentageError)} | ` +
        `${pct(entry.slackForm.error.medianAbsolutePercentageError)} | ` +
        `${pct(entry.constantPooled.error.medianAbsolutePercentageError)} | ` +
        `${pct(entry.incumbentV1.medianAbsolutePercentageError)} | ` +
        `${pct(entry.incumbentArtifact.medianAbsolutePercentageError)} |`),
      "",
      "### Double-blocked (family x seed) holdout by budget",
      "",
      "| budget | law shared | law per-coef | slack form | V1 | artifact |",
      "|---:|---:|---:|---:|---:|---:|",
      ...view.doubleBlocked.byBudget.map((entry: any) =>
        `| ${entry.budget} | ${pct(entry.shared.medianAbsolutePercentageError)} | ` +
        `${pct(entry.perCoefficient.medianAbsolutePercentageError)} | ` +
        `${pct(entry.slackForm.medianAbsolutePercentageError)} | ` +
        `${pct(entry.incumbentV1.medianAbsolutePercentageError)} | ` +
        `${pct(entry.incumbentArtifact.medianAbsolutePercentageError)} |`),
    );
  }
  for (const edge of report.edges) {
    lines.push(
      "",
      `## Edge: ${edge.label} (${edge.policyBudgets.join(", ")}; ${edge.extrapolationFactor}x reference)`,
      "",
      "| population | n | law shared | slack form | V1 | artifact |",
      "|---|---:|---:|---:|---:|---:|",
      `| first completion | ${edge.firstCompletion.n} | ${signedPct(edge.firstCompletion.law_shared)} | ` +
        `${signedPct(edge.firstCompletion.law_slack_form)} | ` +
        `${signedPct(edge.firstCompletion.incumbentV1)} | ` +
        `${signedPct(edge.firstCompletion.incumbentArtifact)} |`,
      `| all fitted kinds | ${edge.allFittedKinds.n} | ${signedPct(edge.allFittedKinds.law_shared)} | ` +
        `${signedPct(edge.allFittedKinds.law_slack_form)} | ` +
        `${signedPct(edge.allFittedKinds.incumbentV1)} | ` +
        `${signedPct(edge.allFittedKinds.incumbentArtifact)} |`,
      `| recorded estimator combined | ${edge.allFittedKinds.n} | ` +
        `${signedPct(edge.allFittedKinds.recordedCombined)} | n/a | n/a | n/a |`,
      `| recorded episode pace | ${edge.allFittedKinds.recordedPace.n} | ` +
        `${signedPct(edge.allFittedKinds.recordedPace)} | n/a | n/a | n/a |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function signedPct(summary: ErrorSummary): string {
  if (summary.n === 0) return "n/a";
  const signed = summary.medianSignedPercentageError;
  return `${pct(summary.medianAbsolutePercentageError)} (${signed === null || signed < 0 ? "" : "+"}${
    signed === null ? "n/a" : (signed * 100).toFixed(1)
  }%)`;
}
