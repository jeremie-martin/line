/**
 * "Believer" - first 56.6s, authored from rhythm-analysis v2.
 *
 * Source slice: beats/believer_56_6s.mp3, extracted from the root video audio.
 *
 * Creative read:
 *   - Believer has a hard 125 BPM primary stomp layer and a real 250 BPM pulse.
 *   - The ride should feel fast and physical, but not become a 0.24s contact
 *     stream. The selected contacts use the primary beat as the backbone, then
 *     promote a few strong secondary pulses in the sparse verse/coil sections.
 *   - Expressive surface is intentionally impact/speed/air/zoom only. No
 *     amplitude/elevation: this leaves the compiler room to turn speed and
 *     landing force into the visible motion.
 *
 * The analysis is evidence, not truth. This spec hand-interprets numeric scores,
 * phrase timing, and rideability constraints.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contact, Curve, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";
import { clamp } from "../core/substrate.ts";

type RhythmRow = {
  t: number;
  grid: {
    pulse_index: number;
    is_primary: boolean;
    meter_pos: number | null;
    primary_index: number | null;
    primary_t: number | null;
    primary_distance: number | null;
  };
  evidence: {
    rms: number;
    energy_jump: number;
  };
  nearest_rnn_onset?: number | null;
  nearest_rnn_onset_dist?: number | null;
  timing?: {
    grid_t: number;
    event_t: number;
    event_source: "primary" | "attack" | "rnn_onset" | "grid";
    event_delta: number;
    attack_t: number | null;
    attack_strength: number;
  };
  scores: {
    metrical: number;
    event: number;
    body: number;
    lift: number;
    decay: number;
    prominence: number;
    contact: number;
    support: number;
    impact: number;
  };
};

type RhythmAnalysis = {
  duration: number;
  tempo_layers: {
    primary?: { bpm?: number | null };
    pulse?: { bpm?: number | null };
  };
  grid: RhythmRow[];
};

const rhythm = JSON.parse(
  readFileSync(resolve("beats/believer_56_6s.rhythm.json"), "utf8"),
) as RhythmAnalysis;

const DURATION = 56.6;
const FIRST_CONTACT_S = 0.45;
const LAST_CONTACT_S = 56.45;
const MIN_EVENT_GAP_S = 0.38;
const PROMOTED_ACCENT_MIN_GAP_S = 0.54;

const PHRASE_ANCHORS = [0.50, 7.70, 15.38, 23.06, 30.74, 38.42, 46.10, 53.78];
const MAX_IMPACT_ANCHORS = [7.70, 15.38, 23.06, 30.74, 38.42, 46.10];
const TAIL_KICK_ANCHORS = [54.74, 55.70];

const PHASES = [
  { name: "INTRO", t0: 0.00, t1: 7.70, minGap: 0.68, color: "#4c74a8" },
  { name: "BUILD", t0: 7.70, t1: 15.38, minGap: 0.42, color: "#c9912e" },
  { name: "VERSE", t0: 15.38, t1: 23.06, minGap: 0.66, color: "#3f8f7c" },
  { name: "RAMP", t0: 23.06, t1: 30.74, minGap: 0.42, color: "#cc6733" },
  { name: "COIL", t0: 30.74, t1: 38.42, minGap: 0.54, color: "#7c61b0" },
  { name: "CHORUS", t0: 38.42, t1: 53.30, minGap: 0.42, color: "#d34842" },
  { name: "OUTRO", t0: 53.30, t1: DURATION, minGap: 0.66, color: "#5f7892" },
] as const;

type Phase = (typeof PHASES)[number];
type ContactKind = "primary" | "accent";
type ContactCandidate = {
  row: RhythmRow;
  t: number;
  kind: ContactKind;
  minGap: number;
  weight: number;
};

function nearAny(t: number, anchors: readonly number[], tolerance = 0.075): boolean {
  return anchors.some((anchor) => Math.abs(t - anchor) <= tolerance);
}

function phaseFor(t: number): Phase {
  return PHASES.find((phase) => t >= phase.t0 && t < phase.t1) ?? PHASES[PHASES.length - 1];
}

function isPhraseAnchor(t: number): boolean {
  return nearAny(t, PHRASE_ANCHORS);
}

function isMaxImpactAnchor(t: number): boolean {
  return nearAny(t, MAX_IMPACT_ANCHORS);
}

function keepPrimaryCandidate(row: RhythmRow): boolean {
  if (!row.grid.is_primary) return false;
  if (row.t < FIRST_CONTACT_S || row.t > LAST_CONTACT_S) return false;
  if (isPhraseAnchor(row.t)) return true;

  const s = row.scores;
  switch (phaseFor(row.t).name) {
    case "INTRO":
      return s.contact >= 0.70 && s.body >= 0.55;
    case "BUILD":
      return s.contact >= 0.72 && s.body >= 0.50;
    case "VERSE":
      return s.contact >= 0.72 && s.body >= 0.50;
    case "RAMP":
      return s.contact >= 0.72 && s.body >= 0.52;
    case "COIL":
      return s.contact >= 0.76 && s.body >= 0.42;
    case "CHORUS":
      return s.contact >= 0.70 && s.body >= 0.45;
    case "OUTRO":
      return s.contact >= 0.66 && s.body >= 0.60;
  }
}

function keepAccentCandidate(row: RhythmRow): boolean {
  if (row.grid.is_primary) return false;
  if (row.t < 1.5 || row.t > 52.9) return false;

  const s = row.scores;
  const phase = phaseFor(row.t).name;
  const strong = s.contact >= 0.64 && s.body >= 0.72 && s.prominence >= 0.70;
  const rising = s.contact >= 0.74 && s.body >= 0.58 && s.prominence >= 0.55 && s.lift >= 0.10;

  switch (phase) {
    case "INTRO":
    case "BUILD":
    case "VERSE":
      return strong;
    case "RAMP":
      return strong || (s.contact >= 0.66 && s.body >= 0.80 && s.prominence >= 0.55);
    case "COIL":
      return strong || rising;
    case "CHORUS":
      return strong || (s.contact >= 0.76 && s.body >= 0.76);
    case "OUTRO":
      return false;
  }
}

function candidateWeight(row: RhythmRow): number {
  const s = row.scores;
  const phase = phaseFor(row.t).name;
  let weight =
    0.80 +
    1.50 * s.contact +
    0.85 * s.impact +
    0.45 * s.body +
    0.35 * s.prominence;

  if (row.grid.is_primary) weight += 0.45;
  else weight += phase === "COIL" || phase === "CHORUS" ? 0.35 : 0.15;
  if (row.grid.meter_pos === 1) weight += 0.50;
  if (isPhraseAnchor(row.t)) weight += 8.00;
  if (isMaxImpactAnchor(row.t)) weight += 1.20;
  if (phase === "INTRO") weight -= 0.15;
  if (phase === "CHORUS") weight += 0.25;
  if (phase === "OUTRO") weight -= 0.45;

  return weight;
}

function candidateFor(row: RhythmRow): ContactCandidate | null {
  const isPrimary = keepPrimaryCandidate(row);
  const isAccent = keepAccentCandidate(row);
  if (!isPrimary && !isAccent) return null;

  return {
    row,
    t: row.t,
    kind: isPrimary ? "primary" : "accent",
    minGap: phaseFor(row.t).minGap,
    weight: candidateWeight(row),
  };
}

function selectedByWeight(candidates: ContactCandidate[]): ContactCandidate[] {
  const rows = [...candidates].sort((a, b) => a.t - b.t);
  const dp: number[] = [];
  const take: boolean[] = [];
  const prev: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    let bestPrev = -1;
    let bestPrevValue = 0;

    for (let j = i - 1; j >= 0; j--) {
      if (rows[i].t - rows[j].t >= Math.max(rows[i].minGap, rows[j].minGap) - 1e-9) {
        bestPrev = j;
        bestPrevValue = dp[j];
        break;
      }
    }

    const takeValue = bestPrevValue + rows[i].weight;
    const skipValue = i === 0 ? 0 : dp[i - 1];
    if (takeValue > skipValue) {
      dp[i] = takeValue;
      take[i] = true;
      prev[i] = bestPrev;
    } else {
      dp[i] = skipValue;
      take[i] = false;
      prev[i] = i - 1;
    }
  }

  const out: ContactCandidate[] = [];
  for (let i = rows.length - 1; i >= 0;) {
    if (take[i]) {
      out.push(rows[i]);
      i = prev[i];
    } else {
      i--;
    }
  }

  return out.reverse();
}

function promoteSyncopatedAccents(
  selected: ContactCandidate[],
  candidates: ContactCandidate[],
): ContactCandidate[] {
  const out = [...selected].sort((a, b) => a.t - b.t);
  const accents = candidates
    .filter((candidate) => candidate.kind === "accent")
    .sort((a, b) => b.weight - a.weight);

  for (const accent of accents) {
    const phase = phaseFor(accent.t).name;
    if (phase !== "VERSE" && phase !== "COIL") continue;
    if (nearAny(accent.t, PHRASE_ANCHORS, 0.30)) continue;
    if (out.some((candidate) => candidate.row === accent.row)) continue;

    const nextIndex = out.findIndex((candidate) =>
      candidate.t > accent.t &&
      candidate.t - accent.t <= 0.30 &&
      candidate.kind === "primary" &&
      !isPhraseAnchor(candidate.t)
    );
    if (nextIndex < 0) continue;

    const prevCandidate = out[nextIndex - 1];
    const nextCandidate = out[nextIndex + 1];
    if (prevCandidate && accent.t - prevCandidate.t < PROMOTED_ACCENT_MIN_GAP_S) continue;
    if (nextCandidate && nextCandidate.t - accent.t < PROMOTED_ACCENT_MIN_GAP_S) continue;

    out[nextIndex] = accent;
    out.sort((a, b) => a.t - b.t);
  }

  return out;
}

function selectedContactRows(): ContactCandidate[] {
  const candidates = rhythm.grid
    .map(candidateFor)
    .filter((candidate): candidate is ContactCandidate => candidate !== null);

  return promoteSyncopatedAccents(selectedByWeight(candidates), candidates);
}

function contactTimeFor(row: RhythmRow): number {
  const hinted = row.timing?.event_t;
  if (typeof hinted === "number" && Number.isFinite(hinted)) {
    return Number(hinted.toFixed(3));
  }

  if (row.grid.is_primary && row.grid.primary_t !== null) {
    return Number(row.grid.primary_t.toFixed(3));
  }

  return Number(row.t.toFixed(3));
}

function impactFor(row: RhythmRow, kind: ContactKind): number {
  if (isMaxImpactAnchor(row.t)) return 1.0;

  const s = row.scores;
  const phase = phaseFor(row.t).name;
  let impact =
    0.12 +
    0.58 * s.impact +
    0.14 * s.body +
    0.10 * s.prominence;

  if (row.grid.meter_pos === 1) impact += 0.08;
  if (isPhraseAnchor(row.t)) impact += 0.12;
  if (kind === "accent") impact += 0.08;
  if (phase === "BUILD" || phase === "RAMP" || phase === "CHORUS") impact += 0.04;
  if (phase === "COIL" && s.body >= 0.85) impact += 0.04;
  if (phase === "INTRO") impact -= s.body < 0.75 ? 0.10 : 0.04;
  if (phase === "OUTRO") impact -= 0.16;
  if (nearAny(row.t, TAIL_KICK_ANCHORS)) impact += 0.10;
  if (s.contact < 0.75) impact -= 0.08;
  if (s.body < 0.45) impact -= 0.10;

  return Number(clamp(impact, 0.12, 1.0).toFixed(3));
}

const contactRows = selectedContactRows();

const contacts: Contact[] = beats(
  contactRows
    .map((candidate) => ({
      t: contactTimeFor(candidate.row),
      impact: impactFor(candidate.row, candidate.kind),
    }))
    .sort((a, b) => a.t - b.t)
    .filter((event, index, events) => index === 0 || event.t - events[index - 1].t >= MIN_EVENT_GAP_S),
);

const speed: Curve = keyframes([
  { t: 0.00, v: 0.58, ease: "smooth" },
  { t: 1.94, v: 0.68, ease: "smooth" },
  { t: 7.70, v: 0.82, ease: "smooth" },
  { t: 15.38, v: 0.76, ease: "smooth" },
  { t: 23.06, v: 0.84, ease: "smooth" },
  { t: 28.82, v: 0.91, ease: "easeIn" },
  { t: 30.74, v: 0.78, ease: "easeOut" },
  { t: 34.34, v: 0.88, ease: "smooth" },
  { t: 38.42, v: 0.96, ease: "smooth" },
  { t: 46.10, v: 1.00, ease: "smooth" },
  { t: 51.86, v: 0.98, ease: "easeOut" },
  { t: 53.78, v: 0.82, ease: "smooth" },
  { t: 56.60, v: 0.70 },
]);

const air: Curve = keyframes([
  { t: 0.00, v: 0.42, ease: "smooth" },
  { t: 7.70, v: 0.50, ease: "smooth" },
  { t: 15.38, v: 0.66, ease: "smooth" },
  { t: 23.06, v: 0.60, ease: "smooth" },
  { t: 30.74, v: 0.72, ease: "easeOut" },
  { t: 34.34, v: 0.78, ease: "smooth" },
  { t: 38.42, v: 0.60, ease: "smooth" },
  { t: 46.10, v: 0.64, ease: "smooth" },
  { t: 51.86, v: 0.62, ease: "smooth" },
  { t: 53.78, v: 0.72, ease: "smooth" },
  { t: 56.60, v: 0.54 },
]);

export const overlayMeta = {
  title: "BELIEVER",
  artist: "IMAGINE DRAGONS",
  tempo: `${rhythm.tempo_layers.primary?.bpm?.toFixed(1) ?? "125.0"} BPM primary / ` +
    `${rhythm.tempo_layers.pulse?.bpm?.toFixed(1) ?? "250.0"} BPM pulse`,
  phases: PHASES.map(({ name, t0, t1, color }) => ({ name, t0, t1, color })),
};

const spec: Spec = {
  duration: DURATION,
  music: {
    audio: "beats/believer_56_6s.mp3",
    title: "Believer",
    artist: "Imagine Dragons",
    tempo: overlayMeta.tempo,
    beats: "beats/believer_56_6s.rhythm.json",
    spectrogram: {
      image: "beats/believer_56_6s.spectrogram.png",
      metadata: "beats/believer_56_6s.spectrogram.json",
    },
  },
  camera: {
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.00, zoom: 2.35 },
        { t: 1.94, zoom: 2.12 },
        { t: 7.70, zoom: 1.82 },
        { t: 15.38, zoom: 2.18 },
        { t: 23.06, zoom: 1.86 },
        { t: 28.82, zoom: 1.74 },
        { t: 30.74, zoom: 1.58 },
        { t: 34.34, zoom: 2.25 },
        { t: 38.42, zoom: 1.55 },
        { t: 42.26, zoom: 1.85 },
        { t: 46.10, zoom: 1.48 },
        { t: 49.94, zoom: 1.72 },
        { t: 53.78, zoom: 2.45 },
        { t: 54.74, zoom: 1.70 },
        { t: 56.60, zoom: 2.10 },
      ],
    },
  },
  contacts,
  jitter: 0,
  axes: {
    speed,
    air,
  },
};

export default spec;
