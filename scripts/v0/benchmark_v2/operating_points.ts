/** Dynamic fixed-N promotion points.  A point is data, not a new code path:
 * calibration registers the exact two artifacts and their hashes, and eval
 * resolves the same `EvalOperatingPoint` shape used by the historical menu. */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { EvalOperatingPoint } from "../../../benchmark/v2/eval-policy.ts";

export const FIXED_N_OPERATING_POINTS_SCHEMA = "line.benchmark-v2.fixed-n-operating-points.v1" as const;
export const FIXED_N_OPERATING_POINTS_PATH = "benchmark/v2/operating-points.json";

export type RegisteredFixedNPoint = {
  id: string;
  mode: "improvement";
  margin: null;
  depth: number;
  criticalAlpha: number;
  futilitySchedule: number[];
  futilityAlpha: number;
  cells: EvalOperatingPoint["cells"];
  certifiedDetectableEffect: number;
  certification: {
    menuCertification: string;
    menuCertificationSha256: string;
    holdoutValidation: string;
    holdoutValidationSha256: string;
  };
  calibrationFingerprint: string;
  registeredAt: string;
};

export function registeredFixedNPoint(depth: number): RegisteredFixedNPoint | undefined {
  const registry = readRegistry();
  return registry.points.find((point) => point.mode === "improvement" && point.depth === depth);
}

export function registeredFixedNAsEvalPoint(depth: number): EvalOperatingPoint | undefined {
  const point = registeredFixedNPoint(depth);
  if (point === undefined) return undefined;
  assertRegisteredArtifacts(point);
  return {
    id: point.id,
    mode: point.mode,
    margin: point.margin,
    depth: point.depth,
    criticalAlpha: point.criticalAlpha,
    futilitySchedule: point.futilitySchedule,
    futilityAlpha: point.futilityAlpha,
    cells: point.cells,
    certifiedDetectableEffect: point.certifiedDetectableEffect,
    certification: {
      menuCertification: point.certification.menuCertification,
      holdoutValidation: point.certification.holdoutValidation,
    },
  };
}

export function operatingPointRegistryStatus(depth: number): {
  registered: boolean;
  pointId: string | null;
  artifactIntegrity: boolean;
  reason: string | null;
  powerDiagnostic: { cell: string; acceptRate: number; wilson95: [number, number] } | null;
} {
  const point = registeredFixedNPoint(depth);
  if (point === undefined) {
    return {
      registered: false,
      pointId: null,
      artifactIntegrity: false,
      reason: `no fixed-N calibration is registered for N=${depth}; run \`benchmark calibrate-point --mode=improve --seeds=${depth}\``,
      powerDiagnostic: null,
    };
  }
  try {
    assertRegisteredArtifacts(point);
    const report = JSON.parse(readFileSync(resolve(point.certification.menuCertification), "utf8"));
    const cell = (report.cells ?? []).find((entry: any) => entry.id === point.cells.power.id);
    const accept = cell?.combined?.accept;
    const diagnostic = typeof accept?.rate === "number" && Array.isArray(accept.wilson95) &&
      accept.wilson95.length === 2 && accept.wilson95.every((value: unknown) => typeof value === "number")
      ? { cell: point.cells.power.id, acceptRate: accept.rate, wilson95: [accept.wilson95[0], accept.wilson95[1]] as [number, number] }
      : null;
    return { registered: true, pointId: point.id, artifactIntegrity: diagnostic !== null, reason: diagnostic === null ? "registered point has no readable power diagnostic" : null, powerDiagnostic: diagnostic };
  } catch (error) {
    return {
      registered: true,
      pointId: point.id,
      artifactIntegrity: false,
      reason: error instanceof Error ? error.message : String(error),
      powerDiagnostic: null,
    };
  }
}

export function fixedNOperatingPointFingerprint(point: RegisteredFixedNPoint): string {
  return sha256(JSON.stringify(point));
}

function readRegistry(): { schema: typeof FIXED_N_OPERATING_POINTS_SCHEMA; points: RegisteredFixedNPoint[] } {
  const path = resolve(FIXED_N_OPERATING_POINTS_PATH);
  if (!existsSync(path)) throw new Error(`fixed-N operating-point registry is missing`);
  const registry = JSON.parse(readFileSync(path, "utf8"));
  if (registry?.schema !== FIXED_N_OPERATING_POINTS_SCHEMA || !Array.isArray(registry.points)) {
    throw new Error(`fixed-N operating-point registry is malformed`);
  }
  const seen = new Set<number>();
  for (const point of registry.points) {
    if (
      point?.mode !== "improvement" || point.margin !== null || !Number.isSafeInteger(point.depth) ||
      point.depth < 8 || point.depth > 300 || seen.has(point.depth) ||
      !Number.isFinite(point.criticalAlpha) || point.criticalAlpha <= 0 || point.criticalAlpha >= 1 ||
      !Array.isArray(point.futilitySchedule) || point.futilitySchedule.length !== 0 ||
      !fingerprint(point.certification?.menuCertificationSha256) ||
      !fingerprint(point.certification?.holdoutValidationSha256) || !fingerprint(point.calibrationFingerprint)
    ) throw new Error(`fixed-N operating-point registry has an invalid entry`);
    seen.add(point.depth);
  }
  return registry;
}

function assertRegisteredArtifacts(point: RegisteredFixedNPoint): void {
  for (const [path, expected] of [
    [point.certification.menuCertification, point.certification.menuCertificationSha256],
    [point.certification.holdoutValidation, point.certification.holdoutValidationSha256],
  ] as const) {
    if (!existsSync(resolve(path)) || sha256(readFileSync(resolve(path))) !== expected) {
      throw new Error(`registered fixed-N point ${point.id} has a missing or changed certification artifact`);
    }
  }
}

function fingerprint(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
