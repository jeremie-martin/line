/**
 * Light rebaseline after an accepted eval attempt (RFC C.5): under
 * fresh-paired attempts the baseline archive is never comparison evidence —
 * only the snapshot is. The accepting attempt's retained canonical archives
 * become the era's record, one fresh 252-compile probe run becomes the
 * dev-screen reference, and the heavyweight freeze validations are reused
 * verbatim via freezeBaseline. Minutes, not hours.
 *
 * `transition` records an explicit ledgered operator transition; the next
 * rebaseline may then be driven from legacy-produced bundle evidence via
 * --bundle (no budget reset — only an accept genuinely ends an era).
 */

import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import { freezeBaseline } from "../../benchmark/freeze_baseline.ts";
import {
  appendAttemptEvent,
  readAttemptEvents,
  readEraState,
  type DeclareEvent,
} from "./attempts.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import {
  initializeConfirmationStateFromBaseline,
  DEFAULT_CONFIRMATION_STATE_PATH,
} from "./confirmation.ts";
import { runBenchmarkV2, compilerCandidateIdentity } from "./runner.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { suiteIdentity } from "./suite_model.ts";

export async function runRebaselineCommand(argv = process.argv.slice(2)): Promise<number> {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  if (process.env.LR_ENGINE !== "wasm") throw new Error(`rebaseline requires LR_ENGINE=wasm`);
  const label = argument("label");
  if (label === undefined || label.trim() === "") throw new Error(`rebaseline requires --label=<new baseline label>`);
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, "-");
  const statePath = resolve(argument("confirmation-state") ?? DEFAULT_CONFIRMATION_STATE_PATH);
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const ledgerPaths = {
    ledger: resolve(argument("attempts-ledger") ?? "benchmark/v2/attempts.jsonl"),
    projection: resolve(argument("era-state") ?? "benchmark/v2/era-state.json"),
  };
  const jobs = Number(argument("jobs") ?? Math.min(48, availableParallelism()));

  const era = readEraState(ledgerPaths);
  const explicitBundle = argument("bundle");
  let cause: "rebaseline-accept" | "transition-rebaseline";
  let bundlePath: string;

  if (explicitBundle !== undefined) {
    if (!era.transitionPending) {
      throw new Error(`--bundle rebaselines a ledgered transition; record one first with \`npm run benchmark -- transition --reason=...\``);
    }
    cause = "transition-rebaseline";
    bundlePath = resolve(explicitBundle);
  } else {
    cause = "rebaseline-accept";
    const lastAttempt = era.attempts.at(-1);
    if (lastAttempt === undefined || lastAttempt.outcome !== "accept") {
      throw new Error(
        `rebaseline requires the era's latest eval attempt to be an accept ` +
        `(latest: ${lastAttempt === undefined ? "none" : `${lastAttempt.attemptId} -> ${lastAttempt.outcome ?? "in flight"}`})`,
      );
    }
    const identity = compilerCandidateIdentity("wasm");
    if (identity.candidateFingerprint !== lastAttempt.candidateFingerprint) {
      throw new Error(`the checked-out compiler is not the candidate accepted by ${lastAttempt.attemptId}`);
    }
    const declare = readAttemptEvents(ledgerPaths).find((event): event is DeclareEvent =>
      event.type === "declare" && event.attemptId === lastAttempt.attemptId
    );
    if (declare === undefined) throw new Error(`accepted attempt has no declare event; the ledger is corrupt`);

    const developmentArchive = resolve(archiveDir, `${lastAttempt.attemptId}-development.json.gz`);
    const qualificationArchive = resolve(archiveDir, `${lastAttempt.attemptId}-qualification.json.gz`);
    for (const [path, what] of [
      [developmentArchive, "development"],
      [qualificationArchive, "qualification"],
    ] as const) {
      if (!existsSync(path)) {
        throw new Error(`retained ${what} archive ${path} is missing; the accepted attempt cannot become the era record`);
      }
    }

    // The one fresh execution a light rebaseline pays for: the dev-screen
    // probe reference of the new baseline compiler.
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const suite = suiteIdentity(
      "benchmark/v2/compat/suite-manifest.json",
      "benchmark/v2/compat/source-manifest.json",
      sources,
    );
    const probeOut = resolve(`generated/benchmark-v2/eval/${safeLabel}-probe.json`);
    mkdirSync(resolve("generated/benchmark-v2/eval"), { recursive: true });
    console.log(`rebaseline ${safeLabel}: running the fresh probe dev-screen reference (252 compiles)`);
    const probeRun = await runBenchmarkV2("development", [
      "--profile=probe",
      `--manifest=${resolve("benchmark/v2/compat/source-manifest.json")}`,
      `--heldout-manifest=${resolve("benchmark/v2/compat/heldout-manifest.json")}`,
      `--suite=${resolve("benchmark/v2/compat/suite-manifest.json")}`,
      `--characterization=${resolve("benchmark/v2/evidence/characterization.json")}`,
      `--audit=${resolve("benchmark/v2/evidence/audit.json")}`,
      `--review=${resolve("benchmark/v2/evidence/candidate-review.json")}`,
      `--listening-review=${resolve("benchmark/v2/evidence/listening-review.json")}`,
      `--jobs=${jobs}`,
      `--out=${probeOut}`,
      ...(argv.includes("--resume") ? ["--resume"] : []),
    ]);
    if (probeRun.workerFailures > 0) throw new Error(`fresh probe reference has worker failures; re-run with --resume`);
    const probeRetained = resolve(archiveDir, `${safeLabel}-probe.json.gz`);
    copyFileSync(`${probeOut}.gz`, probeRetained);
    writeFileSync(`${probeRetained}.sha256`, `${probeRun.compressedArchiveSha256}  ${relativeToCwd(probeRetained)}\n`);

    const bundle = {
      schema: "line.benchmark-v2.baseline-bundle.v3",
      label: safeLabel,
      generatedAt: new Date().toISOString(),
      eraRecord: {
        attemptId: lastAttempt.attemptId,
        operatingPointId: lastAttempt.operatingPointId,
        declarationPath: declare.declarationPath,
        declarationSha256: declare.declarationSha256,
      },
      compilerSnapshot: JSON.parse(readFileSync(resolve(declare.declarationPath), "utf8")).candidateSnapshot,
      decisionContract: requireCurrentDecisionCalibration(suite.suiteFingerprint),
      probe: retainedEntry(probeRetained),
      development: retainedEntry(developmentArchive),
      qualification: retainedEntry(qualificationArchive),
    };
    bundlePath = resolve(archiveDir, `${safeLabel}-baseline.json`);
    writeFileSync(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`);
  }

  freezeBaseline(bundlePath);
  initializeConfirmationStateFromBaseline("benchmark/v2/baseline.json", statePath);
  const newEra = appendAttemptEvent({
    type: "era-start",
    eraId: `era-${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}`,
    cause,
    baselineLabel: safeLabel,
    budgetCap: benchmarkEvalPolicy.eraBudget.cap,
  }, ledgerPaths);
  console.log(
    `rebaselined to ${safeLabel} (${cause}); era budget ` +
    `${cause === "rebaseline-accept" ? "reset" : "carried"} (cap ${newEra.budgetCap}); ` +
    `cumulative expected false accepts ${newEra.cumulativeExpectedFalseAccepts}`,
  );
  console.log(`  nextCommand: npm run benchmark -- eval`);
  return 0;
}

export function runTransitionCommand(argv = process.argv.slice(2)): number {
  const argument = (name: string): string | undefined =>
    argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const reason = argument("reason");
  if (reason === undefined || reason.trim() === "") throw new Error(`transition requires --reason=...`);
  const ledgerPaths = {
    ledger: resolve(argument("attempts-ledger") ?? "benchmark/v2/attempts.jsonl"),
    projection: resolve(argument("era-state") ?? "benchmark/v2/era-state.json"),
  };
  const state = appendAttemptEvent({
    type: "transition",
    reason,
    operator: argument("operator") ?? "unspecified",
  }, ledgerPaths);
  console.log(`transition recorded (no budget reset); rebaseline with --bundle=<legacy baseline bundle> when the new evidence exists`);
  return state.transitionPending ? 0 : 1;
}

function retainedEntry(compressedPath: string): {
  retainedCompressedArchive: string;
  compressedSha256: string;
  sha256: string;
} {
  const bytes = readFileSync(compressedPath);
  return {
    retainedCompressedArchive: relativeToCwd(compressedPath),
    compressedSha256: sha256(bytes),
    sha256: sha256(gunzipSync(bytes)),
  };
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
