/**
 * "TIKI TIKI (Slowed)" - first 48s, authored from rhythm-analysis v2.
 *
 * Source slice: beats/tiki_tiki_48s.mp3, extracted from the root .opus.
 *
 * Contact interpretation:
 *   - pre-6.9s: quiet same-grid support contacts only; visually small;
 *   - 6.9-10.5s: sparse primary beat layer, with 10.43s as the first hard drop;
 *   - post-drop: rows with enough numeric contact evidence become musical
 *     contacts; low-contact fade-out rows can remain quiet support contacts.
 *
 * The analysis is evidence, not truth: this spec hand-interprets numeric scores
 * and phrase timing. It intentionally avoids depending on analysis role labels.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contact, Curve, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";

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

type RhythmTransient = {
  t: number;
  rnn_t: number;
  percussive_strength: number;
  body: number;
  primary_interval: {
    index: number;
    start_t: number;
    end_t: number;
    phase: number;
  };
  nearest_grid_t: number | null;
  nearest_grid_distance: number | null;
};

type RhythmAnalysis = {
  duration: number;
  tempo_layers: {
    primary?: { bpm?: number | null };
    pulse?: { bpm?: number | null };
  };
  primary_beats: number[];
  transients?: RhythmTransient[];
  grid: RhythmRow[];
};

const rhythm = JSON.parse(
  readFileSync(resolve("beats/tiki_tiki_48s.rhythm.json"), "utf8"),
) as RhythmAnalysis;

const INTRO_REAL_BEAT_S = 6.90;
const FIRST_CONTACT_S = 0.75;
const LAST_CONTACT_S = 48.0;
const MIN_GAP_S = 0.40;
const NORMAL_CONTACT_SCORE = 0.55;
const FIRST_BEAT_SECONDARY_SCORE = 0.55;
const SECONDARY_CONTACT_SCORE = 0.79;
const SECONDARY_EVENT_SCORE = 0.88;
const SECONDARY_BODY_SCORE = 0.60;
const PULSE_MATCH_S = 0.10;
const FADE_SUPPORT_S = 42.60;
const FADE_CONTACT_SCORE = 0.70;
const TRANSIENT_START_S = 10.75;
const TRANSIENT_END_S = 41.70;
const TRANSIENT_DUPLICATE_S = 0.16;
const TRANSIENT_HALF_STRENGTH = 1.55;
const TRANSIENT_BODY_SCORE = 0.50;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function isFadeSupport(row: RhythmRow): boolean {
  return row.t >= FADE_SUPPORT_S &&
    row.grid.pulse_index % 2 === 0 &&
    row.scores.support >= 0.45;
}

function isQuietSupport(row: RhythmRow): boolean {
  return row.t < INTRO_REAL_BEAT_S || (isFadeSupport(row) && row.scores.contact < FADE_CONTACT_SCORE);
}

function isHardDrop(row: RhythmRow): boolean {
  return row.scores.contact >= 0.96 && row.scores.body >= 0.80 && row.scores.lift >= 0.45;
}

function isStrongSecondaryContact(row: RhythmRow): boolean {
  return !row.grid.is_primary &&
    row.scores.contact >= SECONDARY_CONTACT_SCORE &&
    row.scores.event >= SECONDARY_EVENT_SCORE &&
    row.scores.body >= SECONDARY_BODY_SCORE;
}

function keepAsContact(row: RhythmRow): boolean {
  if (row.t < FIRST_CONTACT_S || row.t > LAST_CONTACT_S) return false;

  // Before the first perceived beat, keep only the slow-grid supports. They are
  // contacts for physics and camera continuity, not musical hits.
  if (row.t < INTRO_REAL_BEAT_S) {
    return row.grid.is_primary && row.scores.support >= 0.55;
  }

  if (isFadeSupport(row)) return true;
  if (row.t < 10.5 && !row.grid.is_primary) {
    return row.scores.contact >= FIRST_BEAT_SECONDARY_SCORE;
  }
  if (!row.grid.is_primary) return isStrongSecondaryContact(row);
  return row.scores.contact >= (row.t >= FADE_SUPPORT_S ? FADE_CONTACT_SCORE : NORMAL_CONTACT_SCORE);
}

type ContactRow = { t: number; row?: RhythmRow; transient?: RhythmTransient };

function contactTimeFor(row: RhythmRow): number {
  if (isQuietSupport(row)) return Number(row.t.toFixed(3));

  const hinted = row.timing?.event_t;
  if (typeof hinted === "number" && Number.isFinite(hinted)) {
    return Number(hinted.toFixed(3));
  }

  if (row.grid.is_primary && row.grid.primary_t !== null) {
    return Number(row.grid.primary_t.toFixed(3));
  }

  if (
    row.nearest_rnn_onset !== null &&
    row.nearest_rnn_onset !== undefined &&
    (row.nearest_rnn_onset_dist ?? Infinity) <= PULSE_MATCH_S &&
    row.nearest_rnn_onset <= row.t + 0.02
  ) {
    return Number(row.nearest_rnn_onset.toFixed(3));
  }

  return Number(row.t.toFixed(3));
}

function selectedGridContactRows(): ContactRow[] {
  const out: ContactRow[] = [];
  let last = -Infinity;

  for (const row of rhythm.grid) {
    if (!keepAsContact(row)) continue;
    const gridT = Number(row.t.toFixed(3));
    if (gridT - last < MIN_GAP_S) continue;
    const t = contactTimeFor(row);
    out.push({ t, row });
    last = gridT;
  }

  return out;
}

function primaryIntervalIndex(t: number): number | null {
  for (let i = 0; i < rhythm.primary_beats.length - 1; i++) {
    if (t >= rhythm.primary_beats[i] - 1e-6 && t < rhythm.primary_beats[i + 1] - 1e-6) {
      return i;
    }
  }
  return null;
}

function isHalfBeatTransient(tr: RhythmTransient): boolean {
  const phase = tr.primary_interval.phase;
  return phase >= 0.48 && phase <= 0.56;
}

function isAnticipationTransient(tr: RhythmTransient): boolean {
  const phase = tr.primary_interval.phase;
  return phase >= 0.72 && phase <= 0.80;
}

function isSelectableTransient(tr: RhythmTransient): boolean {
  if (tr.t < TRANSIENT_START_S || tr.t >= TRANSIENT_END_S) return false;
  if (tr.body < TRANSIENT_BODY_SCORE) return false;
  return isHalfBeatTransient(tr) && tr.percussive_strength >= TRANSIENT_HALF_STRENGTH;
}

function selectedTransientRows(gridRows: ContactRow[]): ContactRow[] {
  const occupiedIntervals = new Set<number>();
  for (const event of gridRows) {
    const row = event.row;
    if (!row || row.grid.is_primary || isQuietSupport(row)) continue;
    const interval = primaryIntervalIndex(event.t);
    if (interval !== null) occupiedIntervals.add(interval);
  }

  const byInterval = new Map<number, RhythmTransient[]>();
  for (const tr of rhythm.transients ?? []) {
    if (!isSelectableTransient(tr)) continue;
    if (occupiedIntervals.has(tr.primary_interval.index)) continue;
    if (gridRows.some((event) => Math.abs(event.t - tr.t) < TRANSIENT_DUPLICATE_S)) continue;

    const group = byInterval.get(tr.primary_interval.index) ?? [];
    group.push(tr);
    byInterval.set(tr.primary_interval.index, group);
  }

  const out: ContactRow[] = [];
  for (const group of byInterval.values()) {
    const picked = group
      .filter(isHalfBeatTransient)
      .sort((a, b) => b.percussive_strength - a.percussive_strength)[0];

    if (picked) out.push({ t: Number(picked.t.toFixed(3)), transient: picked });
  }

  return out;
}

function selectedContactRows(): ContactRow[] {
  const gridRows = selectedGridContactRows();
  return [...gridRows, ...selectedTransientRows(gridRows)]
    .sort((a, b) => a.t - b.t);
}

const contactRows = selectedContactRows();

function impactFor(row: RhythmRow): number {
  const t = row.t;
  const s = row.scores;

  if (isQuietSupport(row)) return t < INTRO_REAL_BEAT_S ? 0.02 : 0.03;
  if (isHardDrop(row)) return 1.0;
  if (t < 10.5) return Math.min(0.64, 0.22 + 0.48 * s.impact);
  if (t < 24.8) return Math.min(0.76, 0.30 + 0.46 * s.impact);
  if (t < 27.6) return Math.min(0.52, 0.16 + 0.52 * s.impact);
  if (t < 41.1) {
    const downbeatBonus = row.grid.meter_pos === 1 ? 0.14 : 0.0;
    const bodyHitBonus = !row.grid.is_primary && s.body >= 0.85 ? 0.08 : 0.0;
    return Math.min(0.78, 0.22 + 0.44 * s.impact + downbeatBonus + bodyHitBonus);
  }
  if (t < FADE_SUPPORT_S) return Math.min(0.60, 0.24 + 0.48 * s.impact);
  return 0.03;
}

function impactForTransient(tr: RhythmTransient): number {
  const strength = clamp01((tr.percussive_strength - 1.45) / 1.65);
  const phaseBonus = isHalfBeatTransient(tr) ? 0.04 : 0.0;
  return Math.min(0.74, 0.44 + 0.22 * strength + 0.08 * tr.body + phaseBonus);
}

function impactForContact(event: ContactRow): number {
  if (event.row) return impactFor(event.row);
  if (event.transient) return impactForTransient(event.transient);
  return 0.2;
}

const contacts: Contact[] = beats(
  contactRows.map((event) => ({ t: event.t, impact: impactForContact(event) })),
);

function contactIndexForTime(t: number): number {
  for (let i = 0; i < contactRows.length; i++) {
    if (t <= contactRows[i].t) return i;
  }
  return contactRows.length - 1;
}

function gapDurationAt(t: number): number {
  const i = contactIndexForTime(t);
  const prev = i === 0 ? 0 : contactRows[i - 1].t;
  return contactRows[i].t - prev;
}

const amplitude: Curve = (t) => {
  const i = contactIndexForTime(t);
  const end = contactRows[i];
  const gap = gapDurationAt(t);
  const row = end.row;

  if (!row) return gap < 0.32 ? 0.06 : gap < 0.62 ? 0.12 : 0.34;
  if (isQuietSupport(row)) return end.t < INTRO_REAL_BEAT_S ? 0.03 : 0.06;
  if (gap < 0.62) return isHardDrop(row) ? 0.18 : 0.10;
  if (gap > 1.20) return 0.92;
  if (isHardDrop(row)) return end.t < 11 ? 0.94 : end.t < 28 ? 0.70 : 0.76;

  if (end.t < 10.5) return 0.30 + 0.18 * row.scores.contact;
  if (end.t < 24.8) return 0.44;
  if (end.t < 27.6) return 0.20;
  if (end.t < 41.1) return 0.48;
  if (end.t < FADE_SUPPORT_S) return 0.40;
  return 0.08;
};

export const overlayMeta = {
  title: "TIKI TIKI",
  artist: "SLOWED",
  tempo: `${rhythm.tempo_layers.primary?.bpm?.toFixed(1) ?? "69"} BPM primary / ` +
    `${rhythm.tempo_layers.pulse?.bpm?.toFixed(1) ?? "138"} BPM pulse`,
  phases: [
    { name: "SUPPORT INTRO", t0: 0.0, t1: 6.90, color: "#2f6f73" },
    { name: "FIRST BEATS", t0: 6.90, t1: 10.43, color: "#d09728" },
    { name: "DROP HOOK", t0: 10.43, t1: 24.35, color: "#c4483f" },
    { name: "RESET", t0: 24.35, t1: 27.83, color: "#6d5aa8" },
    { name: "RUN", t0: 27.83, t1: 41.74, color: "#d46a2e" },
    { name: "FLOAT OUT", t0: 41.74, t1: 48.0, color: "#3e8f6c" },
  ],
};

const spec: Spec = {
  duration: 48,
  music: {
    audio: "beats/tiki_tiki_48s.mp3",
    title: "TIKI TIKI (Slowed)",
    artist: "Unknown",
    tempo: overlayMeta.tempo,
    beats: "beats/tiki_tiki_48s.rhythm.json",
    spectrogram: {
      image: "beats/tiki_tiki_48s.spectrogram.png",
      metadata: "beats/tiki_tiki_48s.spectrogram.json",
    },
  },
  camera: {
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.0, zoom: 3.00 },
        { t: 6.90, zoom: 2.95 },
        { t: 8.70, zoom: 2.55 },
        { t: 10.43, zoom: 1.70 },
        { t: 12.18, zoom: 2.25 },
        { t: 24.35, zoom: 2.65 },
        { t: 26.09, zoom: 2.35 },
        { t: 27.83, zoom: 1.70 },
        { t: 34.78, zoom: 1.95 },
        { t: 38.26, zoom: 2.05 },
        { t: 41.74, zoom: 2.55 },
        { t: 42.70, zoom: 2.95 },
        { t: 46.18, zoom: 2.65 },
        { t: 48.0, zoom: 3.00 },
      ],
    },
  },
  contacts,
  jitter: 0,
  axes: {
    air: keyframes([
      { t: 0.0, v: 0.42, ease: "smooth" },
      { t: 6.90, v: 0.48, ease: "easeIn" },
      { t: 10.43, v: 0.76, ease: "smooth" },
      { t: 16.53, v: 0.72, ease: "smooth" },
      { t: 24.35, v: 0.66, ease: "easeOut" },
      { t: 27.83, v: 0.78, ease: "smooth" },
      { t: 34.78, v: 0.76, ease: "smooth" },
      { t: 41.74, v: 0.70, ease: "smooth" },
      { t: 46.99, v: 0.84, ease: "easeOut" },
      { t: 48.0, v: 0.58 },
    ]),
    speed: keyframes([
      { t: 0.0, v: 0.32, ease: "smooth" },
      { t: 6.90, v: 0.36, ease: "easeIn" },
      { t: 7.83, v: 0.48, ease: "smooth" },
      { t: 9.619, v: 0.70, ease: "easeIn" },
      { t: 10.43, v: 0.84, ease: "smooth" },
      { t: 16.53, v: 0.74, ease: "smooth" },
      { t: 24.35, v: 0.50, ease: "easeOut" },
      { t: 25.22, v: 0.48, ease: "smooth" },
      { t: 26.09, v: 0.58, ease: "smooth" },
      { t: 26.95, v: 0.73, ease: "easeIn" },
      { t: 27.83, v: 0.88, ease: "smooth" },
      { t: 34.78, v: 0.78, ease: "smooth" },
      { t: 41.74, v: 0.68, ease: "easeOut" },
      { t: 46.99, v: 0.60, ease: "easeOut" },
      { t: 48.0, v: 0.50 },
    ]),
    amplitude,
  },
};

export default spec;
