/**
 * probe_climb_banked — tests the speed↔elevation coupling: a rider must BANK
 * speed before it can climb, and climbing spends that speed.
 *
 * Early gaps run fast and level (build kinetic energy); later gaps ask to climb
 * while the speed target decays (convert that energy to height). If climb
 * achieved here exceeds the constant-speed cap (~0.46), the coupling is real and
 * the authoring rule is "bank speed before a climb, let speed fall during it".
 */
import type { Contact, Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 15; t += 0.5) contacts.push({ t: Number(t.toFixed(3)) });

const spec: Spec = {
  duration: 16,
  contacts,
  axes: {
    // Fast, level build → then spend speed climbing.
    speed: keyframes([{ t: 0, v: 0.95 }, { t: 7, v: 0.95 }, { t: 10, v: 0.35 }], "linear"),
    elevation: keyframes([{ t: 0, v: 0.5 }, { t: 7, v: 0.5 }, { t: 9, v: 0.85 }], "linear"),
  },
  preroll: 5,
};

export default spec;
