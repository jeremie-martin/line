/**
 * Recoverable baseline publication without an attempt ledger.
 *
 * A tiny journal pins the exact bundle bytes while freezeBaseline updates the
 * compact baseline references. Re-running after interruption is idempotent.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { freezeBaseline } from "../../benchmark/freeze_baseline.ts";
import {
  removeFileDurable,
  writeFileExclusiveDurable,
} from "./durable_fs.ts";

export const BASELINE_PUBLICATION_PENDING_PATH = "benchmark/v2/baseline-publication-pending.json";

type PendingBaselinePublication = {
  schema: "line.benchmark-v2.baseline-publication.v2";
  bundlePath: string;
  bundleSha256: string;
  baselineLabel: string;
};

type PublicationOptions = {
  pendingPath?: string;
  conflictingPendingPath?: string;
  baselinePath?: string;
  freeze?: (bundlePath: string) => void;
  afterFreeze?: () => void;
};

export function publishBaseline(bundlePath: string, options: PublicationOptions = {}): void {
  const pendingPath = resolve(options.pendingPath ?? BASELINE_PUBLICATION_PENDING_PATH);
  const conflicting = resolve(options.conflictingPendingPath ?? "benchmark/v2/migration-pending.json");
  if (existsSync(conflicting)) throw new Error(`another baseline-related publication is pending; recover it first`);
  if (existsSync(pendingPath)) throw new Error(`a baseline publication is pending; rerun the command to recover it`);
  const absoluteBundle = resolve(bundlePath);
  const bundleBytes = readFileSync(absoluteBundle);
  const bundle = JSON.parse(bundleBytes.toString("utf8"));
  assertBundle(bundle);
  const pending: PendingBaselinePublication = {
    schema: "line.benchmark-v2.baseline-publication.v2",
    bundlePath: absoluteBundle,
    bundleSha256: sha256(bundleBytes),
    baselineLabel: bundle.label,
  };
  writeFileExclusiveDurable(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
  try {
    (options.freeze ?? freezeBaseline)(absoluteBundle);
    options.afterFreeze?.();
    removeFileDurable(pendingPath);
  } catch (error) {
    // The journal deliberately survives so the exact same bundle can finish.
    throw error;
  }
}

export function recoverPendingBaselinePublication(options: PublicationOptions = {}): boolean {
  const pendingPath = resolve(options.pendingPath ?? BASELINE_PUBLICATION_PENDING_PATH);
  if (!existsSync(pendingPath)) return false;
  const conflicting = resolve(options.conflictingPendingPath ?? "benchmark/v2/migration-pending.json");
  if (existsSync(conflicting)) throw new Error(`migration publication is pending; recover it first`);
  const pending = readPending(pendingPath);
  assertPinnedBundle(pending);
  (options.freeze ?? freezeBaseline)(pending.bundlePath);
  options.afterFreeze?.();
  removeFileDurable(pendingPath);
  return true;
}

export function discardUntouchedPendingBaselinePublication(options: PublicationOptions = {}): void {
  const pendingPath = resolve(options.pendingPath ?? BASELINE_PUBLICATION_PENDING_PATH);
  if (!existsSync(pendingPath)) throw new Error(`no pending baseline publication to discard`);
  const pending = readPending(pendingPath);
  assertPinnedBundle(pending);
  const baselinePath = resolve(options.baselinePath ?? "benchmark/v2/baseline.json");
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
    if (baseline.label === pending.baselineLabel) {
      throw new Error(`the pending publication may already have changed baseline files; recover it instead`);
    }
  }
  removeFileDurable(pendingPath);
}

function readPending(path: string): PendingBaselinePublication {
  const pending = JSON.parse(readFileSync(path, "utf8")) as PendingBaselinePublication;
  if (
    pending.schema !== "line.benchmark-v2.baseline-publication.v2" ||
    typeof pending.bundlePath !== "string" ||
    !/^[a-f0-9]{64}$/.test(pending.bundleSha256) ||
    typeof pending.baselineLabel !== "string" ||
    pending.baselineLabel.trim() === ""
  ) {
    throw new Error(`pending baseline publication is malformed; inspect ${path}`);
  }
  return pending;
}

function assertPinnedBundle(pending: PendingBaselinePublication): void {
  const bytes = readFileSync(pending.bundlePath);
  if (sha256(bytes) !== pending.bundleSha256) {
    throw new Error(`baseline bundle changed after publication was journaled; restore the exact bytes`);
  }
  const bundle = JSON.parse(bytes.toString("utf8"));
  assertBundle(bundle);
  if (bundle.label !== pending.baselineLabel) throw new Error(`pinned baseline label changed`);
}

function assertBundle(bundle: any): void {
  if (
    bundle?.schema !== "line.benchmark-v2.baseline-bundle.v3" ||
    typeof bundle.label !== "string" ||
    bundle.label.trim() === ""
  ) {
    throw new Error(`unsupported baseline bundle`);
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
