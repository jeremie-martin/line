/**
 * syncopated_switchback — explicit non-uniform rhythm with axis reversals.
 *
 * Contacts follow a repeating 2s phrase with uneven offsets rather than a
 * steady drum-grid. The opening block is already fast and grippy, then the
 * axes cross over each other: long/low-contact, short/high-contact, and airy
 * skip. This exercises timing irregularity plus transitions that are not a
 * simple monotonic build.
 *
 * Phrase: t = base + [0.00, 0.35, 0.95], base += 2s.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

// accent the syncopated off-beats (the 0.35 and 0.95 offsets) hard; the on-beat
// downbeat (offset 0) stays soft — a pushed, off-kilter switchback groove.
const phraseImpact = [0.3, 0.9, 0.7];
const contacts: Contact[] = [];
for (let base = 0.75; base < 16; base += 2) {
  [0, 0.35, 0.95].forEach((off, i) => {
    const t = base + off;
    if (t < 16) contacts.push({ t: Number(t.toFixed(3)), impact: phraseImpact[i] });
  });
}

const spec: Spec = {
  duration: 16,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.75 }, { t: 4, v: 0.25 }, { t: 8, v: 0.55 }, { t: 12, v: 0.80 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.82 }, { t: 4, v: 0.65 }, { t: 8, v: 0.45 }, { t: 12, v: 0.70 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.70 }, { t: 4, v: 0.65 }, { t: 8, v: 0.20 }, { t: 12, v: 0.35 }], "hold"),
  },
  preroll: 5,
};

export default spec;
