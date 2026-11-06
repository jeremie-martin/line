/**
 * Schemas + defaults for the per-song production contract.
 *
 *   select.json           — the qualification floors + render settings `produce` reads.
 *   characterization.json — the metric distribution `characterize` writes.
 *
 * Plus the suggested-floor derivation that turns a characterization into a
 * starting select.json: every floor is read off the song's own distribution, so
 * it can never be set so high the song yields zero videos.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import type { Floors } from "./measure.ts";

export type RenderConfig = {
  /** Output resolution "WxH". */
  res: string;
  /** Camera zoom multiplier applied over the spec's zoom plan. */
  zoomMult: number;
  /** Beat-punch gate percentile (0/false disables; spec.camera.beatPunch threshold still applies). */
  beatPunchPct: number;
};

export type SelectConfig = {
  /** Absolute song directory. */
  songDir: string;
  /** Absolute path to the spec module. */
  spec: string;
  /** Absolute path to the audio file. */
  audio: string;
  /** Compile budget (sim-frames). */
  budget: number;
  floors: Floors;
  render: RenderConfig;
};

export const DEFAULT_BUDGET = 1_000_000;
export const DEFAULT_RENDER: RenderConfig = { res: "1080x1920", zoomMult: 1.8, beatPunchPct: 70 };
export const DEFAULT_FLOORS: Floors = { reachedEnd: true, maxOffBeat: 0, score: 0, standTimePctMin: 0, rotationsMin: 0 };

type RawSelect = {
  spec?: string;
  audio?: string;
  budget?: number;
  floors?: Partial<Floors>;
  render?: Partial<RenderConfig>;
};

/**
 * Resolve `<songDir>/select.json` against the defaults. `spec`/`audio` are
 * optional and default to `./spec.ts` / `./audio.mp3` beside the config; if given
 * they resolve relative to the song dir (or absolute). A missing file ⇒ all defaults.
 */
export function loadSelect(songDir: string): SelectConfig {
  const dir = resolve(songDir);
  const path = resolve(dir, "select.json");
  const raw: RawSelect = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {};
  const rel = (p: string | undefined, def: string) => (p ? (isAbsolute(p) ? p : resolve(dir, p)) : resolve(dir, def));
  return {
    songDir: dir,
    spec: rel(raw.spec, "spec.ts"),
    audio: rel(raw.audio, "audio.mp3"),
    budget: raw.budget ?? DEFAULT_BUDGET,
    floors: { ...DEFAULT_FLOORS, ...(raw.floors ?? {}) },
    render: { ...DEFAULT_RENDER, ...(raw.render ?? {}) },
  };
}

// ─────────── distribution stats ───────────

export type MetricStats = {
  mean: number; sd: number; median: number;
  p10: number; p25: number; p75: number; p90: number;
  min: number; max: number;
};

/** Linear-interpolated percentile over an ascending-sorted array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function stats(values: number[]): MetricStats {
  const n = values.length;
  if (n === 0) return { mean: 0, sd: 0, median: 0, p10: 0, p25: 0, p75: 0, p90: 0, min: 0, max: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  return {
    mean, sd, median: percentile(sorted, 50),
    p10: percentile(sorted, 10), p25: percentile(sorted, 25),
    p75: percentile(sorted, 75), p90: percentile(sorted, 90),
    min: sorted[0], max: sorted[n - 1],
  };
}
