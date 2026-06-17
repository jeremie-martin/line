/**
 * "TIKI TIKI (Slowed)" - first 48s, authored from rhythm-analysis v2.
 *
 * Source slice: beats/tiki_tiki_48s.mp3, extracted from the root .opus.
 *
 * Contact interpretation:
 *   - pre-6.9s: quiet same-grid support contacts only; visually small;
 *   - 6.9-10.5s: sparse primary beat layer, with 10.51s as the first hard drop;
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
  readFileSync(resolve("productions/tiki_tiki_48s/audio.json"), "utf8"),
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
const FADE_SUPPORT_S = 42.60;
const FADE_CONTACT_SCORE = 0.70;

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

type ContactRow = { t: number; row: RhythmRow };

function selectedContactRows(): ContactRow[] {
  const out: ContactRow[] = [];
  let last = -Infinity;

  for (const row of rhythm.grid) {
    if (!keepAsContact(row)) continue;
    const t = Number(row.t.toFixed(3));
    if (t - last < MIN_GAP_S) continue;
    out.push({ t, row });
    last = t;
  }

  return out;
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

const contacts: Contact[] = beats(
  contactRows.map(({ t, row }) => ({ t, impact: impactFor(row) })),
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
    { name: "FIRST BEATS", t0: 6.90, t1: 10.51, color: "#d09728" },
    { name: "DROP HOOK", t0: 10.51, t1: 24.43, color: "#c4483f" },
    { name: "RESET", t0: 24.43, t1: 27.91, color: "#6d5aa8" },
    { name: "RUN", t0: 27.91, t1: 41.83, color: "#d46a2e" },
    { name: "FLOAT OUT", t0: 41.83, t1: 48.0, color: "#3e8f6c" },
  ],
};

const spec: Spec = {
  duration: 48,
  music: {
    audio: "productions/tiki_tiki_48s/audio.mp3",
    title: "TIKI TIKI (Slowed)",
    artist: "Unknown",
    tempo: overlayMeta.tempo,
    beats: "productions/tiki_tiki_48s/audio.json",
    spectrogram: {
      image: "productions/tiki_tiki_48s/spectrogram.png",
      metadata: "productions/tiki_tiki_48s/spectrogram.json",
    },
  },
  camera: {
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.0, zoom: 3.00 },
        { t: 6.90, zoom: 2.95 },
        { t: 8.77, zoom: 2.55 },
        { t: 10.51, zoom: 1.70 },
        { t: 12.25, zoom: 2.25 },
        { t: 24.43, zoom: 2.65 },
        { t: 26.17, zoom: 2.35 },
        { t: 27.91, zoom: 1.70 },
        { t: 34.87, zoom: 1.95 },
        { t: 38.35, zoom: 2.05 },
        { t: 41.83, zoom: 2.55 },
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
      { t: 10.51, v: 0.76, ease: "smooth" },
      { t: 16.60, v: 0.72, ease: "smooth" },
      { t: 24.43, v: 0.66, ease: "easeOut" },
      { t: 27.91, v: 0.78, ease: "smooth" },
      { t: 34.87, v: 0.76, ease: "smooth" },
      { t: 41.83, v: 0.70, ease: "smooth" },
      { t: 47.05, v: 0.84, ease: "easeOut" },
      { t: 48.0, v: 0.58 },
    ]),
    speed: keyframes([
      { t: 0.0, v: 0.32, ease: "smooth" },
      { t: 6.90, v: 0.36, ease: "easeIn" },
      { t: 7.90, v: 0.48, ease: "smooth" },
      { t: 9.64, v: 0.70, ease: "easeIn" },
      { t: 10.51, v: 0.84, ease: "smooth" },
      { t: 16.60, v: 0.74, ease: "smooth" },
      { t: 24.43, v: 0.50, ease: "easeOut" },
      { t: 25.30, v: 0.48, ease: "smooth" },
      { t: 26.17, v: 0.58, ease: "smooth" },
      { t: 27.04, v: 0.73, ease: "easeIn" },
      { t: 27.91, v: 0.88, ease: "smooth" },
      { t: 34.87, v: 0.78, ease: "smooth" },
      { t: 41.83, v: 0.68, ease: "easeOut" },
      { t: 47.05, v: 0.60, ease: "easeOut" },
      { t: 48.0, v: 0.50 },
    ]),
    amplitude,
  },
};

export default spec;
