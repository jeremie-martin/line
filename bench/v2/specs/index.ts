/**
 * Bench v2 spec registry.
 *
 * Every music spec exports a `BeatSpec`: a sorted list of beat target
 * frames + metadata. The bench v2 runner takes the spec's beatFrames and
 * feeds them into each existing music strategy from `scripts/bench_music.ts`
 * (which converts beats → Move[] in its own way).
 *
 * Synthetic capability specs (easy-single etc.) live in `./synthetic.ts` and
 * use a different shape — they're full Move[] specs with no beat targets,
 * preserved as regression anchors for the Move framework itself.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type BeatSpec = {
  id: string;
  description: string;
  /** Sorted ascending. */
  beatFrames: number[];
  /** Default duration if the strategy doesn't override. Frames. */
  durationFrames: number;
  /** Loose category for the report grouping. */
  axis: "tempo" | "rhythm" | "long-gap" | "real-music";
};

const FPS = 40;
const sec = (t: number) => Math.round(t * FPS);

// ────────── Tempo axis ──────────

/** Metronome: a landing target every `spacingFrames` frames for `durationFrames` total. */
function metronome(id: string, bpm: number, durationSec: number): BeatSpec {
  // bpm → seconds per beat → frames per beat
  const spacingFrames = Math.max(1, Math.round((60 / bpm) * FPS));
  const beatFrames: number[] = [];
  // Start at frame 30 (PROBLEM.md MIN_FIRST_FRAME convention) so the rider
  // has settled into a stable speed.
  let f = 30;
  while (f < sec(durationSec)) {
    beatFrames.push(f);
    f += spacingFrames;
  }
  return {
    id,
    description: `Metronome @ ${bpm} BPM (every ${spacingFrames}f) for ${durationSec}s — ${beatFrames.length} beats`,
    beatFrames,
    durationFrames: sec(durationSec) + 40,
    axis: "tempo",
  };
}

// ────────── Rhythm axis ──────────

/** Tempo change: A BPM for As seconds, then B BPM for Bs seconds. Tests
 *  multi-segment continuity (PROBLEM.md §Multi-segment continuity). */
function tempoChange(id: string, bpmA: number, secA: number, bpmB: number, secB: number): BeatSpec {
  const beatFrames: number[] = [];
  const spA = Math.round((60 / bpmA) * FPS);
  const spB = Math.round((60 / bpmB) * FPS);
  let f = 30;
  while (f < sec(secA)) { beatFrames.push(f); f += spA; }
  // Continue from current f (not snapped to secA boundary) so the tempo
  // change is seamless in time even though the spacing flips.
  while (f < sec(secA + secB)) { beatFrames.push(f); f += spB; }
  return {
    id,
    description: `Tempo change ${bpmA}→${bpmB} BPM (${secA}s + ${secB}s) — ${beatFrames.length} beats`,
    beatFrames,
    durationFrames: sec(secA + secB) + 40,
    axis: "rhythm",
  };
}

/** Accelerando: smoothly ramp from bpmStart to bpmEnd over durationSec.
 *  Each beat's spacing is interpolated based on the current "tempo time."
 *  This is the *continuous* tempo change — a real musical idiom that the
 *  discrete tempo_change spec doesn't cover. */
function accelerando(id: string, bpmStart: number, bpmEnd: number, durationSec: number): BeatSpec {
  const beatFrames: number[] = [];
  let f = 30;
  const endFrame = sec(durationSec);
  while (f < endFrame) {
    beatFrames.push(f);
    // Current BPM is linear in normalized time t∈[0,1].
    const t = (f - 30) / (endFrame - 30);
    const bpm = bpmStart + (bpmEnd - bpmStart) * Math.min(1, Math.max(0, t));
    const spacingFrames = Math.max(1, Math.round((60 / bpm) * FPS));
    f += spacingFrames;
  }
  return {
    id,
    description: `Accelerando ${bpmStart}→${bpmEnd} BPM over ${durationSec}s — ${beatFrames.length} beats`,
    beatFrames,
    durationFrames: sec(durationSec) + 40,
    axis: "rhythm",
  };
}

/** Sparse-dense: quarters → 16ths → quarters. Tests primitive-pivot mid-spec. */
function sparseDense(id: string): BeatSpec {
  const beatFrames: number[] = [];
  let f = 30;
  // 8s of quarter notes @ 60 BPM (every 40f)
  const sparseEnd = sec(8);
  while (f < sparseEnd) { beatFrames.push(f); f += 40; }
  // 4s of 16ths @ 60 BPM (every 10f) — very dense, expected to stress chain
  const denseEnd = sec(12);
  while (f < denseEnd) { beatFrames.push(f); f += 10; }
  // 8s of quarters again
  const tailEnd = sec(20);
  while (f < tailEnd) { beatFrames.push(f); f += 40; }
  return {
    id,
    description: `Sparse → dense (16ths) → sparse — ${beatFrames.length} beats over 20s`,
    beatFrames,
    durationFrames: sec(20) + 40,
    axis: "rhythm",
  };
}

/** Syncopated: beats on the off-beats only (shifted by half a beat).
 *  Verifies the optimizer isn't accidentally exploiting "round number"
 *  beat positions. */
function syncopated(id: string): BeatSpec {
  // 80 BPM (every 30f), but shifted by 15f so beats land at 30+15=45, 45+30=75, etc.
  const beatFrames: number[] = [];
  let f = 45;
  while (f < sec(20)) { beatFrames.push(f); f += 30; }
  return {
    id,
    description: `Syncopated @ 80 BPM (offset by half a beat) — ${beatFrames.length} beats`,
    beatFrames,
    durationFrames: sec(20) + 40,
    axis: "rhythm",
  };
}

/** Polyrhythm 3:4: two interleaved metronomes. Closest musical analogue
 *  to triplets-against-quarters (jazz, African drumming). */
function polyrhythm34(id: string): BeatSpec {
  // 3 beats per measure vs 4 beats per measure, both spanning the same time.
  // Use 2s measure: 3-beat spacing = 2/3 ≈ 0.667s = 27f; 4-beat spacing = 0.5s = 20f.
  const three: number[] = [];
  const four: number[] = [];
  const endFrame = sec(15);
  for (let f = 30; f < endFrame; f += 27) three.push(f);
  for (let f = 30; f < endFrame; f += 20) four.push(f);
  // Merge and dedupe.
  const set = new Set([...three, ...four]);
  const beatFrames = Array.from(set).sort((a, b) => a - b);
  return {
    id,
    description: `Polyrhythm 3:4 (interleaved 27f + 20f spacing) — ${beatFrames.length} beats`,
    beatFrames,
    durationFrames: sec(15) + 40,
    axis: "rhythm",
  };
}

// ────────── Long-gap axis ──────────

function longGaps(id: string): BeatSpec {
  // Beats at 0s (offset 30f), 5s, 10s, 20s, 25s. Long coast stretches between.
  const beatFrames = [30, sec(5), sec(10), sec(20), sec(25)];
  return {
    id,
    description: `Long gaps (30f, 5s, 10s, 20s, 25s) — tests survival across boring stretches`,
    beatFrames,
    durationFrames: sec(28),
    axis: "long-gap",
  };
}

// ────────── Real music axis ──────────

function loadDrumsCanonical(): BeatSpec {
  const data = JSON.parse(
    readFileSync(resolve("beats/drums_0_30s_60_125.json"), "utf8"),
  ) as { onsets: Array<{ t: number } | number> };
  const beatFrames = data.onsets
    .map((o) => (typeof o === "number" ? o : o.t))
    .map((t) => Math.round(t * FPS))
    .sort((a, b) => a - b);
  return {
    id: "drums_0_30s_60_125",
    description: `Real drums (63 onsets / 30s, canonical evaluation file)`,
    beatFrames,
    durationFrames: sec(31),
    axis: "real-music",
  };
}

/** Load ADTOF kick + snare detections — the structural rhythm of the drum
 *  track (kicks on the downbeat, snares on the backbeat). Distinct musical
 *  shape from the canonical drums file (which appears to be a beat-tracker
 *  consensus, not class-specific). */
function loadAdtofKickSnare(): BeatSpec {
  const data = JSON.parse(
    readFileSync(resolve("beats/detection_adtof.json"), "utf8"),
  ) as { classes: Record<string, Array<{ t: number }>> };
  const kicks = data.classes.kick ?? [];
  const snares = data.classes.snare ?? [];
  const times = new Set<number>();
  for (const e of [...kicks, ...snares]) {
    if (e.t > 30) continue;
    times.add(Math.round(e.t * FPS));
  }
  const beatFrames = Array.from(times).sort((a, b) => a - b);
  return {
    id: "adtof_kick_snare_30s",
    description: `ADTOF kick+snare structural rhythm (first 30s, ${beatFrames.length} beats)`,
    beatFrames,
    durationFrames: sec(31),
    axis: "real-music",
  };
}

/** Same madmom file but using the dense onsets_mix (drum + instrument onsets).
 *  Tests an irregular, naturally-dense beat distribution against the synthetic
 *  metronomes' uniform spacing. */
function loadMadmomOnsets(): BeatSpec {
  const data = JSON.parse(
    readFileSync(resolve("beats/detection_madmom.json"), "utf8"),
  ) as { onsets_drums: number[] };
  const beatFrames = data.onsets_drums
    .filter((t) => t <= 20)
    .map((t) => Math.round(t * FPS))
    .sort((a, b) => a - b);
  return {
    id: "madmom_onsets_drums_20s",
    description: `Madmom drum onsets (first 20s, irregular dense — ${beatFrames.length} beats)`,
    beatFrames,
    durationFrames: sec(21),
    axis: "real-music",
  };
}

// ────────── Registry ──────────

/** Lazy-build registry. Reads beats files on demand (only when bench runs). */
export function buildSpecRegistry(): BeatSpec[] {
  return [
    // Tempo axis (4)
    metronome("metronome_60",  60,  30),
    metronome("metronome_90",  90,  30),
    metronome("metronome_120", 120, 30),
    metronome("metronome_180", 180, 15),
    // Rhythm axis (5)
    tempoChange("tempo_change_60_120", 60, 10, 120, 10),
    accelerando("accelerando_60_180", 60, 180, 30),
    sparseDense("sparse_dense"),
    syncopated("syncopated_off"),
    polyrhythm34("polyrhythm_3v4"),
    // Long-gap axis (1)
    longGaps("long_gaps"),
    // Real music axis (3)
    loadDrumsCanonical(),
    loadAdtofKickSnare(),
    loadMadmomOnsets(),
  ];
}
