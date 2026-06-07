/**
 * "Shelter" (Porter Robinson & Madeon) — first 65.5s, authored as continuous
 * curves over THREE axes: air, speed, and the new `elevation`.
 *
 * elevation ∈ [0,1] is an altitude *trend* relative to the speed-supported
 * vertical band: 0.5 = level (net-zero Δy), →1 = climb as steeply as the current
 * speed safely allows, →0 = plunge. It is RELATIVE to the maximum achievable, and
 * crucially coupled to speed: a rider must BANK speed before it can climb, and a
 * sustained climb spends that speed (constant-speed climb caps ~0.46). So the
 * authoring rule (probe_climb_banked) is: speed up first, then convert that
 * kinetic energy into a climb while speed falls.
 *
 * Shelter is a soaring, emotional track — elevation is the perfect lead voice:
 * the rider literally rises into the hook and the big chorus, banks (descends to
 * gather speed) before the lift, and comes back down through the breakdown.
 *
 * Structure (madmom, beats/shelter_65s.mp3, 100 BPM dead-steady, 4/4):
 *   4-bar phrases: 0.33 / 9.93 / 19.53 / 29.13 / 38.73 / 48.33 / 57.93s
 *   onset-activation energy:
 *     0–8s   INTRO     low (~0.058)
 *     8–16s  HOOK      melody enters, lifts (~0.088)
 *     16–38s VERSE     settles, rolling mid (~0.068)
 *     38–44s RISE      building back up
 *     44–58s CHORUS    sustained peak — the emotional high (~0.093)
 *     58–66s BREAKDOWN drop then a small re-lift (~0.066)
 *
 * Axis story:
 *   elevation  level intro → gentle lift into the hook → rolling verse around
 *              level → a deliberate BANK (descend to gain speed) into 38–44s →
 *              the big chorus SOAR (climb hard as banked speed converts to height)
 *              → release/descend through the breakdown back to level.
 *   speed      climbs through the verse and BANKS HIGH right before the chorus
 *              (38–44s) so there's energy to spend climbing, then decays across
 *              the soar (44–54s), recovering into the breakdown.
 *   air        grounded intro → flowing verse → airy chorus → settle.
 *
 * Contacts: clean 100 BPM grid (beats/shelter_65s.json), 109 contacts @0.6s —
 * the handoff compiler's sweet spot.
 *
 * jitter: 0 — the curves carry all variation; read them exactly.
 *
 * Result (handoff, seed 0, 2M budget): 109/109 hit, full ride, 0 off-beat,
 * score 720.3, axis_rms 0.082 (air 0.07 / speed 0.06 / elevation 0.06).
 *
 * Elevation note: with the honest `ceiling` diagnostic (db5afdb) the realistic
 * per-gap climb is ~0.65 at chorus speed (not 1.0) — so part of a very high
 * chorus target is a true PHYSICS shortfall (author within the ceiling). The rest
 * is AXIS COMPETITION: a high speed (or high air) target at the SAME gap as a
 * climb is antagonistic, because climbing spends speed and long floaty arcs are
 * net-level — equal-weight axis cost then trades the climb away. The fix: bank
 * speed BEFORE the chorus, then
 * let speed DECAY THROUGH the climb (overlap, don't hold), ease air down during
 * the soar, and shape elevation as a PULSE where speed is mid-fall (sustained
 * 0.8 after speed is spent just collapses). Achieved soar ~0.60 at the pulse vs
 * ~0.36 level elsewhere — a visible rise.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/shelter_65s.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

/** Overlay metadata (title/artist/tempo + soft energy phases) for make_overlay_data.ts. */
export const overlayMeta = {
  title: "SHELTER",
  artist: "PORTER ROBINSON & MADEON",
  tempo: "100 BPM · 4/4",
  phases: [
    { name: "INTRO", t0: 0, t1: 9.93, color: "#5b8def" },
    { name: "HOOK", t0: 9.93, t1: 19.53, color: "#3fb6a8" },
    { name: "VERSE", t0: 19.53, t1: 38.73, color: "#6c8cf2" },
    { name: "CHORUS", t0: 38.73, t1: 57.93, color: "#f24f4f" },
    { name: "BREAK", t0: 57.93, t1: 65.5, color: "#a06cf2" },
  ],
};

const spec: Spec = {
  duration: raw.range_s[1],
  contacts,
  jitter: 0,
  axes: {
    // The vertical lead. Level → lift into the hook → rolling verse → BANK down
    // (29–44s, gather speed) → the big CHORUS soar → descend through breakdown.
    // The vertical lead. The climb ceiling is ~1.0 at chorus speed (per the report's
    // `ceiling` field) — the limiter is AXIS COMPETITION, not physics. So the soar is
    // authored HIGH and the other two axes give way during it (speed decays through
    // the climb; air eases down). bank/plunge → release → big soar → descend.
    elevation: keyframes([
      { t: 0, v: 0.50, ease: "smooth" }, // level intro
      { t: 9.93, v: 0.58, ease: "easeOut" }, // hook enters: gentle lift
      { t: 14.0, v: 0.50, ease: "smooth" }, // settle
      { t: 19.53, v: 0.55, ease: "smooth" }, // verse roll up
      { t: 24.0, v: 0.45, ease: "smooth" }, // roll down
      { t: 29.13, v: 0.40, ease: "easeIn" }, // begin the BANK (descend to gain speed)
      { t: 38.73, v: 0.40, ease: "easeOut" }, // banked low, energy stored
      { t: 44.0, v: 0.60, ease: "easeIn" }, // CHORUS: release into the climb
      { t: 46.5, v: 0.74, ease: "smooth" }, // PEAK SOAR — pulse where speed is mid-fall
      { t: 49.0, v: 0.56, ease: "easeOut" }, // come down after the pulse
      { t: 52.0, v: 0.52, ease: "smooth" }, // settle — speed spent, no 2nd climb
      { t: 55.0, v: 0.48, ease: "easeOut" }, // ease toward level
      { t: 57.93, v: 0.40, ease: "smooth" }, // breakdown: descend
      { t: 62.0, v: 0.50, ease: "smooth" }, // settle level
      { t: 65.5, v: 0.50 },
    ]),
    // Bank speed BEFORE the chorus (38–44s), then let it DECAY THROUGH the climb
    // (44–53s) — the decay must overlap the soar so the banked energy is spent on
    // height, not held in antagonism with it. Recover into the breakdown.
    speed: keyframes([
      { t: 0, v: 0.46, ease: "easeIn" },
      { t: 9.93, v: 0.54, ease: "smooth" },
      { t: 19.53, v: 0.60, ease: "smooth" },
      { t: 29.13, v: 0.70, ease: "easeIn" }, // start banking
      { t: 38.73, v: 0.82, ease: "smooth" }, // banked high, ready to climb
      { t: 44.0, v: 0.76, ease: "easeIn" }, // release — start spending immediately
      { t: 47.0, v: 0.58, ease: "easeOut" }, // spent on the climb pulse (overlaps the soar)
      { t: 50.0, v: 0.60, ease: "smooth" }, // hold a floor — don't crash the ride
      { t: 53.0, v: 0.54, ease: "smooth" },
      { t: 57.93, v: 0.58, ease: "smooth" }, // recover
      { t: 65.5, v: 0.52 },
    ]),
    // Airborne fraction carries the verse; through the soar it EASES DOWN so long
    // floaty (net-level) arcs don't pull against the climb — the chorus rises
    // rather than floats. Lifts again afterward.
    air: keyframes([
      { t: 0, v: 0.50, ease: "easeIn" },
      { t: 9.93, v: 0.60, ease: "smooth" }, // hook
      { t: 19.53, v: 0.70, ease: "smooth" }, // verse flowing — air leads here
      { t: 29.13, v: 0.64, ease: "smooth" },
      { t: 38.73, v: 0.62, ease: "smooth" }, // begin easing for the climb
      { t: 44.0, v: 0.56, ease: "smooth" },
      { t: 47.0, v: 0.52, ease: "smooth" }, // low at the climb pulse so elevation wins
      { t: 50.0, v: 0.56, ease: "smooth" },
      { t: 54.0, v: 0.60, ease: "easeOut" },
      { t: 57.93, v: 0.62, ease: "easeOut" }, // breakdown lift
      { t: 65.5, v: 0.50 },
    ]),
  },
};

export default spec;
