import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runCanonicalBenchmark, retainBenchmarkArchive } from "./canonical.ts";
import { runBenchmarkV2 } from "./runner.ts";
import { loadSourceManifest, resolveSources } from "./model.ts";
import { suiteIdentity } from "./suite_model.ts";
import { loadListeningReview, requireApprovedListeningReview } from "./listening_review.ts";
import {
  assertNoAttemptInFlight,
  readAttemptEvents,
  readEraState,
  DEFAULT_ATTEMPTS_LEDGER_PATH,
  type AttemptEventInput,
} from "./attempts.ts";
import { readBaselineContract } from "./confirmation.ts";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import { createCompilerSnapshot } from "./compiler_snapshot.ts";
import { assertCompilerSourcesCommitted } from "./compiler_identity.ts";
import { compilerCandidateIdentity } from "./runner.ts";
import { writeFileAtomicDurable } from "./durable_fs.ts";
import { requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import {
  publishBaselineWithLedger,
  recoverPendingBaselinePublication,
} from "./baseline_publication.ts";

export async function runBaselineBenchmark(args = process.argv.slice(2)): Promise<string> {
  const argument = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return args.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  };
  recoverPendingBaselinePublication();
  const label = argument("label") ?? new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  assertCompilerSourcesCommitted();
  const sourceManifestPath = argument("manifest") ?? "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = argument("suite") ?? "benchmark/v2/compat/suite-manifest.json";
  const listeningReviewPath = argument("listening-review") ?? "benchmark/v2/evidence/listening-review.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  const decisionContract = requireCurrentDecisionCalibration(identity.suiteFingerprint);
  requireApprovedListeningReview(await loadListeningReview(
    listeningReviewPath,
    identity.suiteFingerprint,
    identity.sourceManifestFingerprint,
    sources,
  ));
  assertFullFreezeAllowed(identity.suiteFingerprint);
  const outDir = resolve(argument("out-dir") ?? "generated/benchmark-v2/baseline-runs");
  const archiveDir = resolve(argument("archive-dir") ?? "benchmark/v2/runs");
  const forwarded = args.filter((arg) =>
    !arg.startsWith("--label=") && !arg.startsWith("--out-dir=") &&
    !arg.startsWith("--archive-dir=") && !arg.startsWith("--out=") &&
    !arg.startsWith("--profile=") && !arg.startsWith("--checkpoint=")
  );
  mkdirSync(outDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });
  const compilerSnapshot = createCompilerSnapshot(label, archiveDir);

  const probePath = resolve(outDir, `${label}-probe.json`);
  const probe = await runBenchmarkV2("development", [
    "--profile=probe",
    `--out=${probePath}`,
    ...forwarded,
  ]);
  if (probe.workerFailures > 0) throw new Error(`baseline probe has worker failures`);
  const retainedProbe = retainBenchmarkArchive(probe, archiveDir, `${label}-probe`);

  const canonical = await runCanonicalBenchmark([
    `--label=${label}`,
    `--out-dir=${outDir}`,
    `--archive-dir=${archiveDir}`,
    ...forwarded,
  ]);
  if (canonical.qualification.workerFailures > 0) throw new Error(`baseline qualification has worker failures`);
  const canonicalBundle = JSON.parse(readFileSync(canonical.bundlePath, "utf8"));
  const bundlePath = resolve(archiveDir, `${label}-baseline.json`);
  writeFileAtomicDurable(bundlePath, `${JSON.stringify({
    schema: "line.benchmark-v2.baseline-bundle.v3",
    label,
    generatedAt: new Date().toISOString(),
    decisionContract,
    compilerSnapshot,
    probe: {
      archive: probe.outputPath,
      summary: probe.summaryPath,
      sha256: probe.archiveSha256,
      compressedSha256: probe.compressedArchiveSha256,
      retainedCompressedArchive: retainedProbe.archive,
      retainedSummary: retainedProbe.summary,
      headline: probe.headline,
    },
    development: canonicalBundle.development,
    qualification: canonicalBundle.qualification,
  }, null, 2)}\n`);
  const cause = readAttemptEvents().length === 0 ? "bootstrap" : "suite-rollover";
  const eraStart = {
    type: "era-start",
    eraId: `era-${new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z")}`,
    cause,
    baselineLabel: label,
    budgetCap: benchmarkEvalPolicy.eraBudget.cap,
  } as AttemptEventInput;
  publishBaselineWithLedger(bundlePath, eraStart);
  console.log(`Baseline bundle: ${relativeToCwd(bundlePath)}`);
  return bundlePath;
}

/** The full freeze is the bootstrap and suite-rollover path only; within a
 *  suite the light `rebaseline` after an accepted eval attempt is the way
 *  baselines move. */
function assertFullFreezeAllowed(suiteFingerprint: string): void {
  if (!existsSync(DEFAULT_ATTEMPTS_LEDGER_PATH)) return; // bootstrap
  const era = readEraState();
  assertNoAttemptInFlight(era, "suite rollover");
  const previous = readBaselineContract();
  if (previous.suiteFingerprint !== suiteFingerprint) return; // suite rollover
  throw new Error(
    `a full baseline freeze within the current suite was retired; accept an eval attempt and run \`benchmark rebaseline\``,
  );
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}

if (resolve(process.argv[1] ?? "") === resolve(fileURLToPath(import.meta.url))) {
  await runBaselineBenchmark();
}
