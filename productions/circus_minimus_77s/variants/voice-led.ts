/**
 * Circus Minimus: voice-led hook, an authored listening draft (2026-11-01).
 *
 * Keep the preferred pairs3 reading outside 38–51.15 s. Inside, the singer sets the rhythm:
 * clear attacks, fast F–Ab–F turns, and space through held syllables. No minimum
 * spacing filter, salience cutoff, or rule that sacrifices a word to a bass hit.
 * Times below are chosen from sung.json's vocal attacks, not snapped to its
 * nearest mixed-instrument event (42.632, for example, maps to synth at 42.678).
 * Strengths are hand-shaped from vocal peak/share and the phrase's role.
 *
 * Bass anchors: reinforce words at 38.487, 39.706, 41.691 and 44.884; retain
 * separate heavy entries at 42.853, 46.057 and 48.065. The bass at 40.461 and
 * 46.870 sits under the next vocal attack; don't add a second nearly coincident
 * hit. Omit 43.665 and 49.272 to leave the sung rhythm in front. Snares, ghost
 * drums, hats and synth pickups do not interrupt this section's vocal line.
 *
 * 39.880/46.277 are unpitched low-share attacks: no extra landing. Borderline
 * 43.073/49.133/49.911 are listening questions, not automatically words.
 * 46.103 is also borderline; the separate bass anchor at 46.057 carries that
 * moment. The pitch change at 47.102 IS retained despite its low salience.
 * Continue following the voice into the bass-free break (50.155/50.585/50.910),
 * then leave room for the existing strong re-entry at 51.28.
 *
 * This is musical intent, not a claim that every current compiler seed can
 * realize it. Review the clicks against the mix and vocal stem before adoption.
 */
import type { Contact, Spec } from "../../../scripts/v0/types.ts";
import { beats } from "../../../scripts/v0/core/beats.ts";
import pairs3 from "./pairs3.ts";

export { overlayMeta } from "../music.ts";

export const vocalHook: Contact[] = [
  // Pickup, then the first phrase: firm words, a lighter quick descending turn.
  { t: 38.150, impact: 0.49 },
  { t: 38.487, impact: 0.84 }, // voice + section downbeat
  { t: 39.114, impact: 0.66 },
  { t: 39.451, impact: 0.60 },
  { t: 39.706, impact: 0.68 }, // repeated note + 808
  { t: 40.136, impact: 0.65 },
  { t: 40.519, impact: 0.62 },
  { t: 40.716, impact: 0.49 }, // F: keep the quick return
  { t: 40.948, impact: 0.64 },
  // Second phrase: repeated notes are separate articulations, not a long rail.
  { t: 41.691, impact: 0.77 },
  { t: 42.318, impact: 0.55 },
  { t: 42.632, impact: 0.59 },
  { t: 43.317, impact: 0.48 },
  { t: 43.514, impact: 0.61 },
  { t: 43.909, impact: 0.55 },
  { t: 44.130, impact: 0.62 },
  // Third phrase: retain the repeated-note pickup and the 174 ms Ab–F turn.
  { t: 44.884, impact: 0.81 },
  { t: 45.116, impact: 0.52 },
  { t: 45.511, impact: 0.60 },
  { t: 45.859, impact: 0.59 },
  { t: 46.544, impact: 0.66 },
  { t: 46.928, impact: 0.62 },
  { t: 47.102, impact: 0.50 }, // F, then hold: no synthetic subdivision
  // Closing phrase: downbeat comes first, the voice answers off it.
  { t: 48.309, impact: 0.58 },
  { t: 48.692, impact: 0.52 },
  { t: 49.354, impact: 0.61 },
  { t: 49.737, impact: 0.57 },
  // Bass drops out; the singer still has three clear articulations.
  { t: 50.155, impact: 0.43 },
  { t: 50.585, impact: 0.54 },
  { t: 50.910, impact: 0.47 },
];

export const hookBass: Contact[] = [
  { t: 42.853, impact: 0.73 },
  { t: 46.057, impact: 0.72 },
  { t: 48.065, impact: 0.78 },
];

const spec: Spec = {
  ...pairs3,
  contacts: beats([
    ...pairs3.contacts.filter(c => c.t < 38 || c.t >= 51.15),
    ...vocalHook,
    ...hookBass,
  ].sort((a, b) => a.t - b.t)),
};
export default spec;
