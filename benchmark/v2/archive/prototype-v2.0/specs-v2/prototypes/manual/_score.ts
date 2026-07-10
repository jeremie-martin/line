import type { Contact } from "../../../../../../../scripts/v0/types.ts";

export function pulse(start: number, end: number, period: number): number[] {
  const out: number[] = [];
  for (let t = start; t <= end + 1e-9; t += period) out.push(round(t));
  return out;
}

export function mergeTimes(...groups: readonly number[][]): number[] {
  return [...new Set(groups.flat().map(round))].sort((a, b) => a - b);
}

export function authoredContacts(
  times: readonly number[],
  impactAt: (time: number, index: number) => number,
): Contact[] {
  return times.map((t, index) => ({ t, impact: clamp01(impactAt(t, index)) }));
}

export function near(time: number, anchors: readonly number[], tolerance = 0.025): boolean {
  return anchors.some((anchor) => Math.abs(time - anchor) <= tolerance);
}

export function alternating(index: number, low: number, high: number): number {
  return index % 2 === 0 ? high : low;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
