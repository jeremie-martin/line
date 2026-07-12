import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { freezeBaseline } from "../../benchmark/freeze_baseline.ts";
import {
  assertNoAttemptInFlight,
  withAttemptLedgerTransaction,
  type AttemptEventInput,
  type AttemptPaths,
  type EraState,
} from "./attempts.ts";

export const BASELINE_PUBLICATION_PENDING_PATH = "benchmark/v2/baseline-publication-pending.json";

type PendingBaselinePublication = {
  schema: "line.benchmark-v2.baseline-publication.v1";
  bundlePath: string;
  bundleSha256: string;
  event: AttemptEventInput;
};

type PublicationOptions = {
  paths?: AttemptPaths;
  pendingPath?: string;
  conflictingPendingPath?: string;
  freeze?: (bundlePath: string) => void;
  afterFreeze?: () => void;
  afterLedgerAppend?: () => void;
};

/** Publish baseline files and their ledger transition as one recoverable unit. */
export function publishBaselineWithLedger(
  bundlePath: string,
  event: AttemptEventInput,
  options: PublicationOptions = {},
): EraState {
  const pendingPath = resolve(options.pendingPath ?? BASELINE_PUBLICATION_PENDING_PATH);
  const conflictingPendingPath = resolve(options.conflictingPendingPath ?? "benchmark/v2/migration-pending.json");
  const freeze = options.freeze ?? freezeBaseline;
  return withAttemptLedgerTransaction(options.paths, (transaction) => {
    assertNoAttemptInFlight(transaction.state, "baseline publication");
    if (existsSync(conflictingPendingPath)) {
      throw new Error(`migration publication is pending; recover it before publishing a baseline`);
    }
    transaction.assertAllowed(event);
    if (existsSync(pendingPath)) {
      throw new Error(`another baseline publication is pending; recover it before publishing`);
    }
    const pendingEvent = event;
    const pending: PendingBaselinePublication = {
      schema: "line.benchmark-v2.baseline-publication.v1",
      bundlePath: resolve(bundlePath),
      bundleSha256: sha256(readFileSync(resolve(bundlePath))),
      event: pendingEvent,
    };
    assertPinnedBundleMatchesEvent(pending);
    writeFileSync(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, { flag: "wx" });
    try {
      assertBundleCurrent(pending);
      freeze(pending.bundlePath);
      options.afterFreeze?.();
      const state = transaction.append(event);
      options.afterLedgerAppend?.();
      rmSync(pendingPath, { force: true });
      return state;
    } catch (error) {
      // The journal is intentionally retained. A rerun completes the same
      // freeze/event pair before any formal baseline reader can proceed.
      throw error;
    }
  });
}

export function recoverPendingBaselinePublication(options: PublicationOptions = {}): EraState | null {
  const pendingPath = resolve(options.pendingPath ?? BASELINE_PUBLICATION_PENDING_PATH);
  const conflictingPendingPath = resolve(options.conflictingPendingPath ?? "benchmark/v2/migration-pending.json");
  if (!existsSync(pendingPath)) return null;
  const pending = JSON.parse(readFileSync(pendingPath, "utf8")) as PendingBaselinePublication;
  if (
    pending.schema !== "line.benchmark-v2.baseline-publication.v1" ||
    typeof pending.bundlePath !== "string" || !/^[a-f0-9]{64}$/.test(pending.bundleSha256) ||
    pending.event === null || typeof pending.event !== "object"
  ) {
    throw new Error(`pending baseline publication is malformed; inspect ${pendingPath}`);
  }
  const freeze = options.freeze ?? freezeBaseline;
  return withAttemptLedgerTransaction(options.paths, (transaction) => {
    assertNoAttemptInFlight(transaction.state, "baseline publication recovery");
    if (existsSync(conflictingPendingPath)) {
      throw new Error(`migration publication is pending; recover it before recovering a baseline publication`);
    }
    if (publicationEventApplied(transaction.state, pending.event)) {
      rmSync(pendingPath, { force: true });
      return transaction.state;
    }
    transaction.assertAllowed(pending.event);
    assertPinnedBundleMatchesEvent(pending);
    freeze(pending.bundlePath);
    options.afterFreeze?.();
    const state = transaction.append(pending.event);
    rmSync(pendingPath, { force: true });
    return state;
  });
}

function assertBundleCurrent(pending: PendingBaselinePublication): void {
  if (!existsSync(pending.bundlePath) || sha256(readFileSync(pending.bundlePath)) !== pending.bundleSha256) {
    throw new Error(`baseline bundle changed after publication was journaled; restore the exact bundle before recovery`);
  }
}

function assertPinnedBundleMatchesEvent(pending: PendingBaselinePublication): void {
  assertBundleCurrent(pending);
  if (pending.event.type !== "era-start" && pending.event.type !== "baseline-transition-complete") {
    throw new Error(`baseline publication requires an era-start or baseline-transition-complete event`);
  }
  const bundle = JSON.parse(readFileSync(pending.bundlePath, "utf8"));
  if (bundle.schema !== "line.benchmark-v2.baseline-bundle.v3") {
    throw new Error(`unsupported baseline bundle`);
  }
  if (bundle.label !== pending.event.baselineLabel) {
    throw new Error(
      `baseline publication event label ${JSON.stringify(pending.event.baselineLabel)} ` +
      `does not match pinned bundle label ${JSON.stringify(bundle.label)}`,
    );
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function publicationEventApplied(state: EraState, event: AttemptEventInput): boolean {
  if (event.type === "era-start") {
    return state.eraId === event.eraId && state.baselineLabel === event.baselineLabel;
  }
  if (event.type === "baseline-transition-complete") {
    return state.baselineLabel === event.baselineLabel && !state.transitionPending;
  }
  return false;
}
