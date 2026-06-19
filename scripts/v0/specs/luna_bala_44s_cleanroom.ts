/**
 * LUNA BALA (Slowed) — first 44s — clean-room spec.
 *
 * Authored by reading the measured layers in beats/luna_bala_44s.audio.json under
 * the method in docs/creative_workflow.md. Every musical decision is traceable to
 * a measurement, not to the beat-grid hypothesis:
 *
 *   - INTRO (0 → 8.55s) is BEATLESS. The kick band is flat: `band_sub` max over the
 *     whole intro = 0.0148, and segments[0..2] report mean_band_sub ≈ 0.001. The
 *     grid lists 15 beats through here but every one sits on `sub` ≈ 0.00 — it is
 *     extrapolated pulse, not played drums. So the intro gets gentle SUPPORT touches
 *     (impact 0.04) at ~1s spacing for ride/camera continuity, never hard landings.
 *
 *   - DROP at 8.58s: a hard segment edge (segments: 4.435–8.568 rms 0.29 → 8.568–8.684
 *     rms 0.80, mean_band_sub 0.001 → 0.654) where the frame-level `band_sub` jumps
 *     0.015 → 0.823 → 0.886 and `onset_strength` peaks at 0.928. This is the marquee
 *     landing, impact pinned 1.0.
 *
 *   - BODY (8.58 → 42.92s): a steady four-on-the-floor where the kick is on every
 *     grid beat (`band_sub` ≈ 0.85–1.0 throughout). This is the reliable-procedural
 *     region: read the grid kick times directly. Impact is driven by the MEASURED
 *     attack: downbeats (meter_pos 1) carry `onset_strength` ≈ 0.6–1.0, off-beats
 *     ≈ 0.13, so the rule maps onset → felt landing intensity. The 24.4–26.0 bar is
 *     a percussive fill (grid perc 0.77–0.86, micro-segments at 24.94/25.50) — the
 *     grid captures it, so we keep it as written and let impact carry the accents.
 *
 *   - BREAKDOWN SYNCOPATION (36–38s): here the felt kicks fall OFF the grid. In
 *     `onsets[]` the real percussive hits are 36.94 (str 0.61, pr 0.48, sub 0.84),
 *     37.36 (str 0.51, pr 0.42) and 37.78 (str 0.71, pr 0.57), while the grid beat
 *     at 37.47 is a weak in-between (onset_strength 0.12). So we land on the onsets
 *     and DROP grid 37.47. We also drop grid 38.02 (it would sit 0.24s after 37.78 —
 *     below the gap budget) and resolve into 38.56.
 *
 *   - TAIL: the music has a final accent (frame `band_sub` re-peaks 0.967 at 42.40
 *     and 0.91 at 42.95), then collapses: past 43.19s `band_sub`/`rms` fall to the
 *     noise floor (sub → 0 by 43.5, rms settles ~0.045). The last grid beat at 43.47
 *     sits ON that collapse (perc 0.012, sub 0.022) — NOT a played beat. So the last
 *     contact is 42.92 and we stop there; the spec's final ~1s is the song dying out.
 */

import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { beats } from "../core/beats.ts";
import { clamp } from "../core/substrate.ts";

const DROP_T = 8.58;

// ── Intro support touches (0 → drop): beatless, gentle, ~1s spacing ──────────
// Read off no grid — these are continuity touches, not music. Last one at 7.6
// leaves a ~1.0s float into the drop so the rider can bow high and slam at 8.58.
const introSupport = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 7.6].map((t) => ({ t, impact: 0.04 }));

// ── Body grid beats, each annotated with its MEASURED onset_strength / percussive ──
// Read straight from beat_grid.beats where band_sub confirms a real kick. The
// 36–38 breakdown is hand-edited below (onsets in, weak grid beats out).
type BodyBeat = { t: number; ons: number; perc: number };
const bodyRaw: BodyBeat[] = [
  { t: 8.58, ons: 0.9279, perc: 1.0 }, // DROP (impact pinned to 1.0 below)
  { t: 9.13, ons: 0.1387, perc: 0.4313 },
  { t: 9.67, ons: 0.1444, perc: 0.4797 },
  { t: 10.21, ons: 0.1568, perc: 0.4423 },
  { t: 10.76, ons: 0.7829, perc: 0.5369 },
  { t: 11.31, ons: 0.1323, perc: 0.5221 },
  { t: 11.85, ons: 0.1354, perc: 0.4626 },
  { t: 12.4, ons: 0.1908, perc: 0.3514 },
  { t: 12.94, ons: 0.7353, perc: 0.3868 },
  { t: 13.49, ons: 0.1348, perc: 0.4296 },
  { t: 14.03, ons: 0.1416, perc: 0.5196 },
  { t: 14.57, ons: 0.167, perc: 0.409 },
  { t: 15.12, ons: 0.6037, perc: 0.4446 },
  { t: 15.67, ons: 0.4096, perc: 0.4136 },
  { t: 16.21, ons: 0.516, perc: 0.399 },
  { t: 16.76, ons: 0.5088, perc: 0.5043 },
  { t: 17.3, ons: 0.5299, perc: 0.5121 },
  { t: 17.85, ons: 0.1419, perc: 0.3978 },
  { t: 18.4, ons: 0.1384, perc: 0.5106 },
  { t: 18.94, ons: 0.1554, perc: 0.4073 },
  { t: 19.48, ons: 0.6117, perc: 0.4868 },
  { t: 20.03, ons: 0.1332, perc: 0.5346 },
  { t: 20.58, ons: 0.1363, perc: 0.5024 },
  { t: 21.12, ons: 0.212, perc: 0.3395 },
  { t: 21.66, ons: 0.6624, perc: 0.3979 },
  { t: 22.21, ons: 0.1418, perc: 0.4434 },
  { t: 22.76, ons: 0.1458, perc: 0.4835 },
  { t: 23.3, ons: 0.1539, perc: 0.434 },
  { t: 23.84, ons: 0.7557, perc: 0.5497 },
  { t: 24.39, ons: 0.5954, perc: 0.765 }, // ── percussive fill bar ──
  { t: 24.93, ons: 0.6856, perc: 0.8611 },
  { t: 25.48, ons: 0.6027, perc: 0.7871 },
  { t: 26.02, ons: 0.6807, perc: 0.5915 },
  { t: 26.57, ons: 0.1167, perc: 0.4262 },
  { t: 27.12, ons: 0.1321, perc: 0.435 },
  { t: 27.66, ons: 0.1427, perc: 0.3031 },
  { t: 28.2, ons: 1.0, perc: 0.5331 }, // strongest downbeat in the body
  { t: 28.76, ons: 0.1239, perc: 0.4655 },
  { t: 29.3, ons: 0.1169, perc: 0.339 },
  { t: 29.84, ons: 0.1809, perc: 0.3374 },
  { t: 30.38, ons: 0.8434, perc: 0.4661 },
  { t: 30.93, ons: 0.1208, perc: 0.4387 },
  { t: 31.48, ons: 0.1348, perc: 0.457 },
  { t: 32.02, ons: 0.1443, perc: 0.3188 },
  { t: 32.56, ons: 0.7665, perc: 0.4806 },
  { t: 33.11, ons: 0.4631, perc: 0.3326 },
  { t: 33.65, ons: 0.6243, perc: 0.3381 },
  { t: 34.2, ons: 0.6321, perc: 0.4169 },
  { t: 34.74, ons: 0.7099, perc: 0.5998 },
  { t: 35.29, ons: 0.1402, perc: 0.3905 },
  { t: 35.84, ons: 0.1489, perc: 0.416 },
  { t: 36.38, ons: 0.1566, perc: 0.2946 },
  // ── breakdown syncopation: land on onsets[], drop weak grid 37.47 & 38.02 ──
  { t: 36.92, ons: 0.6494, perc: 0.4471 }, // grid downbeat (onset 36.94)
  { t: 37.36, ons: 0.5135, perc: 0.4222 }, // OFF-GRID onset (str 0.51, pr 0.42)
  { t: 37.78, ons: 0.7077, perc: 0.5739 }, // OFF-GRID onset (str 0.71, pr 0.57)
  { t: 38.56, ons: 0.1772, perc: 0.2726 }, // resolve back onto the grid
  { t: 39.11, ons: 0.5743, perc: 0.4112 },
  { t: 39.65, ons: 0.1292, perc: 0.4065 },
  { t: 40.2, ons: 0.1407, perc: 0.4138 },
  { t: 40.74, ons: 0.1513, perc: 0.2681 },
  { t: 41.29, ons: 0.7803, perc: 0.4376 },
  { t: 41.83, ons: 0.6422, perc: 0.3464 },
  { t: 42.38, ons: 0.3931, perc: 0.2829 },
  { t: 42.92, ons: 0.548, perc: 0.3376 }, // last played beat; song collapses after 43.19
];

// Impact from the measured attack: harder onset ⇒ harder landing (doc §Impact).
const body = bodyRaw.map(({ t, ons, perc }) => ({
  t,
  impact: t === DROP_T ? 1.0 : clamp(0.18 + 0.85 * ons + 0.1 * perc, 0.12, 1.0),
}));

const contacts = beats([...introSupport, ...body]);

const spec: Spec = {
  duration: 44,
  music: {
    audio: "beats/luna_bala_44s.mp3",
    title: "LUNA BALA (Slowed)",
    tempo: "111 BPM · 4/4",
    beats: "beats/luna_bala_44s.audio.json",
  },
  contacts,
  jitter: 0, // the axis curves carry the variation
  axes: {
    // air: floaty/airy in the beatless intro, grounded & punchy once the kick lands,
    // a touch more air through the syncopated breakdown, settling at the tail.
    air: keyframes([
      { t: 0, v: 0.78, ease: "smooth" },
      { t: 7.6, v: 0.7, ease: "easeIn" }, // start dropping toward the slam
      { t: 8.58, v: 0.34, ease: "smooth" }, // grounded on the drop
      { t: 24.0, v: 0.38, ease: "smooth" },
      { t: 26.0, v: 0.4, ease: "smooth" }, // fill: ~0.54s gaps can't go fully grounded
      { t: 28.2, v: 0.38, ease: "smooth" },
      { t: 36.0, v: 0.42, ease: "smooth" }, // breakdown: a little more float
      { t: 38.5, v: 0.34, ease: "smooth" },
      { t: 42.92, v: 0.45 },
    ]),
    // speed: builds through the intro into the drop, steady-driving body, eases at tail.
    // Kept modest late (gravity overshoots speed) so the dense bars stay catchable.
    speed: keyframes([
      { t: 0, v: 0.3, ease: "easeIn" },
      { t: 8.58, v: 0.6, ease: "smooth" }, // drop arrives with pace
      { t: 24.0, v: 0.66, ease: "smooth" },
      { t: 28.2, v: 0.72, ease: "smooth" }, // strongest-downbeat climax
      { t: 34.74, v: 0.62, ease: "smooth" },
      { t: 42.92, v: 0.5 },
    ]),
    // amplitude: needs sparse gaps + speed to read, so it lives on the long float into
    // the drop and stays low across the dense ~0.5s body bars (which physically can't pop).
    amplitude: keyframes([
      { t: 0, v: 0.4, ease: "smooth" },
      // The float into the drop WANTS a big bow, but the 1.0 slam needs a steep
      // approach — the two fight (docs §"High impact and high amplitude fight").
      // The drop slam is the marquee event, so amplitude yields: a modest lift only.
      { t: 7.6, v: 0.3, ease: "easeIn" },
      { t: 8.58, v: 0.14, ease: "smooth" }, // dense body: keep low
      { t: 36.0, v: 0.2, ease: "smooth" }, // small lift through the breakdown
      { t: 38.5, v: 0.14, ease: "smooth" },
      { t: 42.92, v: 0.16 },
    ]),
  },
  camera: {
    zoom: {
      smoothingFrames: 8,
      keyframes: [
        { t: 0, zoom: 1.4 }, // wide, quiet intro
        { t: 8.58, zoom: 1.0 }, // punch in on the drop
        { t: 24.0, zoom: 0.85 }, // tighten through the fill / climax
        { t: 28.2, zoom: 0.8 },
        { t: 36.0, zoom: 0.95 }, // breathe a touch for the breakdown
        { t: 42.92, zoom: 1.2 }, // pull back as the song dies
      ],
    },
  },
};

export default spec;
