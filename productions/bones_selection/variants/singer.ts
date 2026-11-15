/**
 * Bones, handcrafted: "The singer".
 *
 * Idea. The voice leads the whole clip, bridge and chorus alike. The emphasis is the sung line: in the bridge every
 * word lands by how clearly it is sung, and the listener hears her without being pushed; in the chorus the two heavy
 * drum hits of each bar keep the frame, and her sharpest words between them land as a third voice in the bar. The
 * lighter drum strokes are mostly left to the ear: only the one that runs into the second hit is kept.
 *
 * What lands, and how hard:
 * - The bridge: clear words 0.30–0.44 (the sharpest, 3.54, 4.60, 6.69, the most), softer words 0.16, bass entries 0.34.
 * - The pickup: her four sharp words are the build (0.46 to 0.58); the drum strokes follow them (0.50–0.62).
 * - The chorus entry: 1. Heavy hits 0.80 and 0.82; her accents between them 0.46; the stroke into the second hit
 *   0.34; fills climb to 0.92.
 * - The release: her last word (49.98) 0.40, two strokes, a ride-out.
 * Air: more air in the bridge, she has room; lower in the chorus where three things share a bar.
 * Speed: unhurried in the bridge; fast in the chorus.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import { curve } from "../../../scripts/v0/core/measured.ts";
import * as m from "../music.ts";

export const overlayMeta = m.overlayMeta;
type Row = [number, number];
const at = (times: number[], impact: number | ((t: number, i: number) => number)): Row[] =>
  times.map((t, i) => [t, typeof impact === "number" ? impact : impact(t, i)]);
/** The chorus has sixteen bars; this is a bar's number (0–15) from a hit's place in its list. */
const fill = (i: number) => i % 4 === 3;
const ROWS: Row[] = [
  ...at(m.CLEAR_WORDS, t => ({3.54: 0.44, 4.60: 0.44, 6.69: 0.42, 0.38: 0.40, 9.97: 0.40, 12.04: 0.38})[t] ?? 0.30),
  ...at(m.SOFT_WORDS, 0.16), ...at(m.BASS_ENTRIES, 0.34),
  ...at(m.PICKUP_WORDS, (_, i) => 0.46 + 0.04 * i), ...at(m.PICKUP_DRUMS, (_, i) => 0.50 + 0.06 * i),
  ...at(m.FIRST, (_, i) => i === 0 ? 1.00 : 0.80),
  ...at(m.FILL, 0.86),
  ...at(m.SECOND, (_, i) => fill(i) ? 0.92 : 0.82),
  ...at(m.BEFORE_SECOND, 0.34),
  ...at(m.VOICE_ACCENTS, t => t > m.RELEASE - 0.1 ? 0.40 : 0.46),
  ...at(m.RELEASE_STROKES, (_, i) => [0.32, 0.36][i]),
];
const AIR = curve([[0, 0.58], [8.6, 0.58], [15.0, 0.54], [16.4, 0.46], [17.1, 0.64], [m.CHORUS, 0.46], [49.7, 0.46], [50.6, 0.40], [51.4, 0.18], [m.DURATION, 0.10]]);
const SPEED = curve([[0, 0.38], [14.9, 0.42], [16.3, 0.58], [m.CHORUS, 0.80], [49.7, 0.84], [50.6, 0.56], [52.0, 0.34], [m.DURATION, 0.22]]);

const spec: Spec = {
  duration: m.DURATION,
  music: m.music,
  camera: { zoom: m.zoom },
  contacts: beats(m.table(ROWS)),
  axes: { air: AIR, speed: SPEED },
};
export default spec;
