/**
 * impact_feel — a FELT-LABELING instrument for the current impact metric (not a benchmark; not in
 * GOLDEN_SPECS). Loaded via `run.ts --spec` and rendered for the /impact/ video dashboard so a human
 * can WATCH each landing and judge how hard it feels vs what was authored. Authored NATIVELY on the
 * current felt scale (0 = soft, 1 = very strong), no migration.
 *
 *   Section 1 — STAIRCASE: impact 0.1 → 1.0, two beats per level, well-spaced. The gap grows with the
 *     ask (hard hits get the vy budget they need) and amplitude + air rise WITH impact — aligned
 *     authoring, so the same up-arc that makes amplitude/air also delivers the redirection and each
 *     level is physically achievable. Question to the eye: does 0.3 feel soft, 0.5 medium, 1.0 strong?
 *   Section 2 — SPEED: impact held at 0.7, forward speed swept 0.4 → 1.0. The raw
 *     contact-redirection impulse is speed-weighted, so the same authored impact needs the right
 *     arrival conditions; it is not free on a slow flat approach.
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
const PER = 2;
const gapSec = (lv: number) => 1.0 + 1.0 * lv; // room for the vy budget + clear spacing in the video

const contacts: Contact[] = [];
const ampKf: { t: number; v: number }[] = [];
const airKf: { t: number; v: number }[] = [];
const spdKf: { t: number; v: number }[] = [];
let t = 1.5;

// Section 1 — staircase 0.1 → 1.0, aligned setup
for (const lv of LEVELS) {
  for (let i = 0; i < PER; i++) {
    contacts.push({ t: Number(t.toFixed(3)), impact: lv });
    ampKf.push({ t: Number(t.toFixed(3)), v: +(0.20 + 0.70 * lv).toFixed(3) });
    airKf.push({ t: Number(t.toFixed(3)), v: +(0.35 + 0.45 * lv).toFixed(3) });
    spdKf.push({ t: Number(t.toFixed(3)), v: 0.70 });
    t += gapSec(lv);
  }
}

// Section 2 — speed sweep at fixed impact 0.7
t += 1.5;
const SPEEDS = [0.40, 0.55, 0.70, 0.85, 1.0];
for (const sp of SPEEDS) {
  for (let i = 0; i < PER; i++) {
    contacts.push({ t: Number(t.toFixed(3)), impact: 0.7 });
    ampKf.push({ t: Number(t.toFixed(3)), v: 0.5 });
    airKf.push({ t: Number(t.toFixed(3)), v: 0.55 });
    spdKf.push({ t: Number(t.toFixed(3)), v: sp });
    t += 1.6;
  }
}

const spec: Spec = {
  duration: Math.ceil(t + 1.5),
  contacts,
  axes: {
    speed: keyframes(spdKf, "smooth"),
    air: keyframes(airKf, "linear"),
    amplitude: keyframes(ampKf, "linear"),
  },
  preroll: 5,
};
export default spec;
