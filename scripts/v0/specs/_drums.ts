/**
 * Shared helper: load the canonical drums_0_30s_60_125 onsets and filter to
 * Contacts that are reasonable for v0 to compile against.
 *
 * Filter rules:
 *   - drop onsets with t < 0.5s (rider needs head time to gain vy for first catch;
 *     the first onset at t=0.02 is essentially at the spawn frame)
 *   - drop any onset that's < 0.4s after the previously kept onset (preserves the
 *     natural ~0.48s drums spacing, just guards against duplicates / tight pairs)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Section, Contact } from "../types.ts";

type Onset = { t: number; votes: number };

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_30s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: Onset[] };

function filteredContacts(): Contact[] {
  const out: Contact[] = [];
  let last = -Infinity;
  for (const o of raw.onsets) {
    if (o.t < 0.5) continue;
    if (o.t - last < 0.4) continue;
    out.push({ t: o.t });
    last = o.t;
  }
  return out;
}

export function drumsSpec(sections: Section[]): Spec {
  return {
    duration: raw.range_s[1],
    contacts: filteredContacts(),
    sections,
  };
}
