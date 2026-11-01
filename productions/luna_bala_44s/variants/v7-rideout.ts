/**
 * Luna Bala, v7-rideout (stratum P7: ride-outs, long riding on geometry at low air).
 *
 * Reading. The only sustained passage in this song is the voice-only intro
 * (0–8.6 s, mix 0.17–0.40, about half the body's level: calm). Its voice is legato:
 * one word every 0.4–0.6 s, but only three words are real attacks, standing well
 * apart from the rest by their vocal rise: 0.174 (0.31), 1.579 (0.31, after the
 * breath dip at 1.40) and 4.493 (0.29, the re-entry after the stop). Every other
 * word enters at 0.08–0.21: a pitch change inside one continuous line, not a new
 * hit. So the intro is read as two long legato lines, each ridden on geometry from
 * its attack to the next landing:
 * - ride-out 1, 1.579 → 4.493 (2.91 s), air 0.30: the second half of phrase 1
 *   (A♯4 A♯4 A4 on 2.078, 2.659, 3.216), then the stop, where the voice falls
 *   silent (3.50, mix 0.03–0.07). The voice sings for the first 1.9 s of the gap and
 *   the last 0.99 s are silence, a third of the gap: the rider rides while the voice
 *   sings and leaves the line as it stops, landing the re-entry 4.493;
 * - ride-out 2, 4.493 → 8.615 (4.12 s), air 0.18: the whole of phrase 2, legato up
 *   to the drop (the last word 8.069 is held to 8.5). The rider rides the build,
 *   gaining speed, and leaves late to fall onto the drop. Riding here, not floating:
 *   a long float into the drop read wrong on Trouble because the music before it
 *   was busy; here it is a calm, continuous voice.
 * The ladder is 1.1 s (ordinary), 2.9 s and 4.1 s; the song has no longer sustained
 * passage (see the omissions), so there is no ~6 s rung.
 *
 * Landed:
 * - 0.441, the earliest landable word (the close pair 0.174–0.441; 0.174 itself
 *   cannot be landed, FIRST_WORD in music.ts), then an ordinary 1.14 s gap to 1.579;
 * - 1.579 and 4.493, the two attacks, by their measured vocal rise (wordStrength:
 *   0.34 and 0.33, clear light hits);
 * - the drop 8.615, pinned 1.0 (kick and snare, mix rise 0.85: the song's loudest
 *   arrival, structural);
 * - the body, the tom break and body B by the kick pulse (every on-beat kick, 0.545
 *   s; the bar downbeat with its layered snare and "hey" a step up; kickStrength
 *   from the drum stem's peak), ordinary riding at ordinary air;
 * - the last kick 42.957, then the collapse to the end.
 *
 * Deliberately left out:
 * - the legato words inside the ride-outs (1.033 before ride-out 1, which falls in
 *   the ordinary gap; 2.078, 2.659, 3.216; 4.667, 5.074, 5.387, 5.944, 6.444, 6.989,
 *   7.523, 8.069): soft entries of one line (rise 0.08–0.21), the held line is what
 *   the rides follow. 4.667–5.387 are the intro's only close words, but they too
 *   enter softly (rise 0.12–0.18; 4.667 is a borderline note 0.17 s after the
 *   re-entry, a short-pair difficulty that belongs to P1, not here);
 * - off-beats and fill off-beats (other strata; the body here is ordinary riding);
 * - any ride-out in the body or the tom break: the kicks are every 0.545 s at equal
 *   loudness (drums 0.82–0.88) and the toms are as loud as any kick, so nothing
 *   there is sustained; skipping audible hits to make room would be harder asks,
 *   not music;
 * - the collapse (42.957 → 44.00, mix 0.05): a ride-out, but with no next impact to
 *   land (the faint sung A♯4 at 43.514 is not a hit), so it cannot be a P7 gap;
 *   ridden out at low air all the same.
 */
import type { Spec } from "../../../scripts/v0/types.ts";
import { keyframes } from "../../../scripts/v0/core/curves.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import {
  BREAK_IN, DROP, DURATION, KICKS, LAST_KICK, REENTRY, VOICE_REENTRY,
  kf, kickStrength, landings, music, overlayMeta, wordStrength, zoom,
} from "../music.ts";

const FIRST_LANDABLE = 0.441;
const PHRASE1_ATTACK = 1.579;

const times = landings([FIRST_LANDABLE, PHRASE1_ATTACK, VOICE_REENTRY], KICKS);
const strength = (t: number) => (t === DROP ? 1.0 : t < DROP ? wordStrength(t) : kickStrength(t, 0.5, 0.18));

// The gap target is the mean of the curve over the gap's frames, so the air steps
// within ±0.05 s of each ride-out's landings (the -15 ms jolt stays inside).
const E = 0.05;
const air = keyframes(kf([
  [0.0, 0.6], [PHRASE1_ATTACK - E, 0.6],
  [PHRASE1_ATTACK + E, 0.3], [VOICE_REENTRY - E, 0.3],
  [VOICE_REENTRY + E, 0.18], [DROP - E, 0.18],
  [DROP + E, 0.68], [BREAK_IN, 0.66], [REENTRY, 0.66], [42.4, 0.66],
  [LAST_KICK + E, 0.3], [DURATION, 0.3],
], "linear"));

const spec: Spec = {
  duration: DURATION,
  music,
  camera: {
    beatPunch: { threshold: 0.78, amp: 0.14, floor: 0.5, decay: 4, attack: 1, dir: "in" },
    zoom: { smoothingFrames: 8, keyframes: zoom },
  },
  contacts: beats(times.map((t) => ({ t, impact: strength(t) }))),
  jitter: 0,
  axes: {
    air,
    speed: keyframes(kf([
      [0.0, 0.38], [PHRASE1_ATTACK, 0.4], [VOICE_REENTRY, 0.4], [6.4, 0.48], [DROP - 0.3, 0.6],
      [DROP, 0.74], [12.0, 0.74], [BREAK_IN, 0.76], [REENTRY, 0.8], [30.0, 0.76], [42.4, 0.72],
      [LAST_KICK, 0.55], [DURATION, 0.42],
    ])),
  },
};

export default spec;
export { overlayMeta };

export const bench = {
  stratum: "P7" as const,
  pattern: "ride-outs on the legato voice: 2.9 s and 4.1 s at low air",
  windows: [[1.5, 4.55], [4.55, 8.7]] as Array<[number, number]>,
};
