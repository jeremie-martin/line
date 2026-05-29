import { createHash } from "node:crypto";

export const FLOAT_EPS = 1e-12;
export const GEOMETRY_GRID = 1e-6;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function roundToGrid(value: number, grid = GEOMETRY_GRID): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value / grid) * grid;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function stableHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function hashParts(...parts: readonly unknown[]): string {
  return stableHash(parts);
}

export function compareNumber(a: number, b: number, eps = FLOAT_EPS): number {
  if (Math.abs(a - b) <= eps) return 0;
  return a < b ? -1 : 1;
}

export function compareString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareTuple(parts: readonly number[]): number {
  for (const part of parts) {
    if (part !== 0) return part;
  }
  return 0;
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const child = (value as Record<string, unknown>)[key];
    if (child !== undefined) out[key] = canonicalize(child);
  }
  return out;
}
