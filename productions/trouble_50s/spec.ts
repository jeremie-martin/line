/**
 * "Trouble" — first 50.3 s. Draft v1, authored event by event from separated stems
 * (docs/music-authoring.md): productions/trouble_50s/events.json, built by
 * tools/music/{stems,drums,events}.py, read alongside the close-up sheets.
 *
 * Structure, as the stems show it:
 *   0.37        opening crash (cymbal + kick);
 *   0.4–14.7    intro led by the voice; chord entries every ~0.9–1.8 s;
 *   14.71–27.24 groove: drums and bass enter; the kick plays 3-3-2
 *               (0.67, 0.67, 0.45 s), so no regular grid fits it;
 *   27.6–29.0   break: drums and bass stop, voice alone;
 *   29.02       the drop (kick + crash + bass, the loudest rise in the clip);
 *   29.0–43.4   stop-and-go: each phrase stops, the bass re-enters ~0.21 s before
 *               a heavy kick, a tom follows; twice three kicks 0.33 s apart;
 *   43.4–46.2   vocal break; 46.2–46.95 drum build; then 3-3-2 kicks again.
 *
 * Every landing below is a measured event. Strength follows the event's measured
 * loudness in the instrument that leads it. Events deliberately NOT landed on:
 *   - the bass re-entries 0.21 s before each heavy kick (30.59, 34.17, 37.76,
 *     39.55, 41.30) and the toms 0.22 s after a kick (31.71, 35.29, 38.87, 42.46):
 *     too close to their kick for two separate landings; the kick is the accent;
 *   - the voice in the break (27.7–28.9): the rider floats into the drop;
 *   - the drum build (46.2–46.9): a swell, no distinct hit; floats into 46.95;
 *   - the kick at 50.09: 0.2 s before the clip ends.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Contact, Curve, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { beats } from "../../scripts/v0/core/beats.ts";

type Source = { t: number; peak: number; rise: number; classes?: string[] };
type MusicEvent = { t: number; sources: Record<string, Source>; mix: { peak: number; rise: number } };

const events = (JSON.parse(readFileSync(resolve(import.meta.dirname, "events.json"), "utf8")) as { events: MusicEvent[] }).events;
const audio = JSON.parse(readFileSync(resolve(import.meta.dirname, "audio.json"), "utf8")) as {
  tempo: { madmom_bpm: number | null; librosa_bpm: number | null };
};

const DURATION = 50.3;
const GROOVE_T = 14.71;
const DROP_T = 29.02;
const STOP_T = 43.4;
const BUILD_END_T = 46.95;

/** The measured event at an authored time (within 30 ms). */
function event(t: number): MusicEvent {
  const e = events.reduce((best, x) => (Math.abs(x.t - t) < Math.abs(best.t - t) ? x : best));
  if (Math.abs(e.t - t) > 0.03) throw new Error(`no measured event at ${t}`);
  return e;
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ─────────── Landings, section by section ───────────

// Voice-led intro: the opening crash, then vocal phrase starts and chord entries.
const INTRO = [0.37, 2.12, 3.51, 5.77, 7.55, 8.01, 8.85, 9.36, 10.70, 12.45, 12.93, 13.40, 13.83, 14.29];
// Groove: every kick of the 3-3-2 pattern.
const GROOVE = [14.71, 15.38, 16.05, 16.50, 17.16, 17.83, 18.28, 18.96, 19.63, 20.07, 20.74, 21.41, 21.86,
  22.53, 23.20, 23.65, 24.32, 24.99, 25.44, 26.11, 26.79, 27.24];
// Drop section: the drop, every heavy kick, and the toms that stand alone.
const DROP_SECTION = [29.02, 29.93, 30.82, 31.50, 32.61, 33.49, 34.40, 34.74, 35.07, 36.19, 37.08, 37.99,
  38.66, 39.78, 40.66, 41.56, 41.90, 42.24];
// Vocal break, then the kicks after the build.
const VOCAL_BREAK = [43.77, 44.23, 44.91, 45.62, 46.02];
const OUTRO = [46.95, 47.61, 48.27, 48.73, 49.41];

function impactFor(t: number): number {
  const e = event(t);
  if (Math.abs(t - DROP_T) < 0.03) return 1.0; // the drop: pinned
  const drums = e.sources.drums?.peak ?? 0;
  if (t < GROOVE_T || (t >= STOP_T && t < BUILD_END_T - 0.03)) {
    if (t < 1) return 0.5; // opening crash: a real hit, kept medium at the very start
    // Voice-led: gentle, by how sharply the voice or chord enters; builds over the
    // last ~2.5 s of the intro into the groove.
    const entry = Math.max(e.sources.vocals?.rise ?? 0, e.sources.other?.rise ?? 0);
    const build = t < GROOVE_T && t > 11.8 ? (t - 11.8) / (GROOVE_T - 11.8) : 0;
    return Number(clamp(0.04 + 0.4 * entry + 0.18 * build, 0.04, 0.35).toFixed(3));
  }
  // Drum-led: the drum hit's measured loudness (0.6–1.0) carries straight to strength.
  return Number(clamp(0.9 * drums, 0.2, 0.9).toFixed(3));
}

const contactTimes = [...INTRO, ...GROOVE, ...DROP_SECTION, ...VOCAL_BREAK, ...OUTRO]
  .map((t) => Number(event(t).t.toFixed(3)))
  .sort((a, b) => a - b);
const contacts: Contact[] = beats(contactTimes.map((t) => ({ t, impact: impactFor(t) })));

// ─────────── Axes ───────────

const speed: Curve = keyframes([
  { t: 0.0, v: 0.36, ease: "smooth" },
  { t: 12.0, v: 0.42, ease: "smooth" },
  { t: GROOVE_T, v: 0.56, ease: "easeIn" },
  { t: 27.24, v: 0.62, ease: "smooth" },
  { t: DROP_T, v: 0.78, ease: "easeIn" }, // build speed through the float into the drop
  { t: 42.3, v: 0.80, ease: "smooth" },
  { t: STOP_T, v: 0.60, ease: "smooth" },
  { t: 46.0, v: 0.52, ease: "smooth" },
  { t: BUILD_END_T, v: 0.66, ease: "easeIn" },
  { t: DURATION, v: 0.64 },
]);

const air: Curve = keyframes([
  { t: 0.0, v: 0.60, ease: "smooth" },
  { t: GROOVE_T, v: 0.64, ease: "smooth" },
  { t: DROP_T, v: 0.70, ease: "smooth" },
  { t: STOP_T, v: 0.66, ease: "smooth" },
  { t: DURATION, v: 0.66 },
]);

export const overlayMeta = {
  title: "TROUBLE",
  artist: "",
  tempo: `${audio.tempo.librosa_bpm?.toFixed(1) ?? "129.2"} BPM (librosa); kick in 3-3-2`,
  phases: [
    { name: "VOICE INTRO", t0: 0.0, t1: GROOVE_T, color: "#3a5f8a" },
    { name: "GROOVE 3-3-2", t0: GROOVE_T, t1: 27.6, color: "#d46a2e" },
    { name: "BREAK", t0: 27.6, t1: DROP_T, color: "#5f7892" },
    { name: "DROP · STOP-AND-GO", t0: DROP_T, t1: STOP_T, color: "#c4483f" },
    { name: "VOCAL BREAK · BUILD", t0: STOP_T, t1: BUILD_END_T, color: "#5f7892" },
    { name: "GROOVE 3-3-2", t0: BUILD_END_T, t1: DURATION, color: "#d46a2e" },
  ],
};

const spec: Spec = {
  duration: DURATION,
  music: {
    audio: "productions/trouble_50s/audio.mp3",
    title: "Trouble",
    artist: "Unknown",
    tempo: overlayMeta.tempo,
    beats: "productions/trouble_50s/audio.json",
    spectrogram: {
      image: "productions/trouble_50s/spectrogram.png",
      metadata: "productions/trouble_50s/spectrogram.json",
    },
  },
  camera: {
    beatPunch: { threshold: 0.80, amp: 0.13, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0.0, zoom: 2.60 },
        { t: GROOVE_T, zoom: 2.10 },
        { t: DROP_T, zoom: 1.80 },
        { t: STOP_T, zoom: 2.30 },
        { t: BUILD_END_T, zoom: 2.00 },
        { t: DURATION, zoom: 2.30 },
      ],
    },
  },
  contacts,
  jitter: 0,
  axes: { air, speed },
};

export default spec;
