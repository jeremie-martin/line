/**
 * "Petrunko", a 60 s instrumental selection: the measured layers its handcrafted variants share. Times are events
 * from events.json; loudness is the mix envelope. There is no singing: the "upper figure" is an instrument.
 *
 *   0–2        A sustained low phrase (mix near 1), closed by one drum hit at 0.58.
 *   2–11.4     The upper figure alone over a faint tick every 0.68 s. Its notes mostly fall on the ticks.
 *   11.5–17    The build: a drum hit on every tick (11.48 … 16.94), figure notes between some of them.
 *   17.3–19.7  The drums double (every 0.34 s).
 *   19.8–21.0  The roll: strokes every 0.09–0.18 s.
 *   21.0–22.4  Silence but for one voice-like note at 21.71.
 *   22.40      The return (the sharpest attack of the clip).
 *   22.4–55.3  The replies, in bars of 2.73 s (four ticks). Each bar opens with a lighter stroke; one to three full
 *              drum hits follow. A bass note answers most drum hits 0.12–0.15 s later, too close to land both. Nine
 *              of those bass notes are as loud as the drums or louder, with a sharp attack (26.98, 33.13, 44.05,
 *              54.96 the heaviest): the low replies. Between bars a loud held note sometimes swells with no attack
 *              (38.1, 41.2, 49.0, 52.1).
 *   56.5–60    The decay: five strokes, softer each time.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { measuredSong } from "../../scripts/v0/core/measured.ts";

const song = measuredSong(import.meta.dirname);
export const { event, table } = song;

export const DURATION = 60;
export const BUILD = 11.48;
export const ROLL = 19.78;
export const SUSPEND = 21.0;
export const RETURN = 22.40;
export const DECAY = 56.0;

export const OPENING_HIT = 0.58;
/** The upper figure's notes before the build, with how sharply each enters (0–1). */
export const FIGURE: Array<[number, number]> = [[1.96, 0.26], [2.31, 0.21], [3.31, 0.30], [4.00, 0.41], [4.68, 0.54], [5.12, 0.35], [6.05, 0.47], [7.41, 0.33],
  [8.78, 0.36], [9.45, 0.37], [10.14, 0.40], [10.81, 0.09]];
/** The faint ticks under the figure that carry no figure note. */
export const BARE_TICKS = [1.26, 2.63, 5.36, 6.72, 8.08];
export const BUILD_DRUMS = [11.48, 12.17, 12.85, 13.53, 14.21, 14.90, 15.57, 16.25, 16.94];
/** Figure notes between two build hits (the others sit within 0.13 s of a hit). */
export const BUILD_FIGURE = [11.98, 13.27, 16.00];
export const DOUBLED = [17.28, 17.61, 17.96, 18.31, 18.65, 18.98, 19.33, 19.67];
/** The roll's strokes that are 0.16 s or more apart. */
export const ROLL_STROKES = [19.84, 20.02, 20.19, 20.35, 20.54, 20.70, 20.88];
export const SUSPENDED_NOTE = 21.71;
/** The lighter stroke that opens each bar of the replies. */
export const BAR_STROKES = [23.75, 26.48, 29.21, 31.94, 34.67, 37.41, 40.12, 42.85, 45.58, 48.31, 51.04, 53.77];
/** The full drum hits of the replies. */
export const REPLY_DRUMS = [24.78, 25.12, 26.83, 27.50, 27.84, 29.56, 30.57, 32.29, 32.96, 33.30, 35.69, 36.03, 37.74, 38.42, 38.75, 40.47, 41.48, 43.19,
  43.86, 44.21, 46.60, 46.94, 48.65, 49.33, 49.67, 51.37, 52.40, 54.10, 54.78, 55.12];
/** The low replies: bass notes as loud as a drum hit, sharply attacked. */
export const LOW_REPLIES = [26.98, 27.99, 32.41, 33.13, 37.87, 38.92, 44.05, 54.23, 54.96];
export const DECAY_STROKES = [56.48, 57.50, 57.85, 59.21, 59.56];

for (const t of [OPENING_HIT, ...FIGURE.map(f => f[0]), ...BARE_TICKS, ...BUILD_DRUMS, ...BUILD_FIGURE, ...DOUBLED, ...ROLL_STROKES, SUSPENDED_NOTE,
  RETURN, ...BAR_STROKES, ...REPLY_DRUMS, ...LOW_REPLIES, ...DECAY_STROKES]) event(t);

export const overlayMeta = {
  title: "PETRUNKO", artist: "", tempo: "a tick every 0.68 s",
  phases: [
    { name: "LOW PHRASE", t0: 0, t1: 1.96, color: "#3a5f8a" },
    { name: "UPPER FIGURE", t0: 1.96, t1: BUILD, color: "#5f7892" },
    { name: "BUILD", t0: BUILD, t1: ROLL, color: "#d4843a" },
    { name: "ROLL", t0: ROLL, t1: SUSPEND, color: "#d46a2e" },
    { name: "SUSPEND", t0: SUSPEND, t1: RETURN, color: "#6d5aa8" },
    { name: "REPLIES", t0: RETURN, t1: DECAY, color: "#c4483f" },
    { name: "DECAY", t0: DECAY, t1: DURATION, color: "#3e8f6c" },
  ],
};
export const music: Spec["music"] = {
  audio: "productions/petrunko_selection/audio.mp3", title: "Petrunko", beats: "productions/petrunko_selection/audio.json",
  spectrogram: { image: "productions/petrunko_selection/spectrogram.png", metadata: "productions/petrunko_selection/spectrogram.json" },
};
