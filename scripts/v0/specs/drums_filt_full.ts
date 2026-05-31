/**
 * Handoff comparison — variant A: ≥0.4s spacing filter over the WHOLE 0–56s
 * range (golden-style spacing applied everywhere). Single no-axis section so
 * filtering is the only variable across the three comparison specs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { constant } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const MIN_SPACING = 0.4; // seconds, enforced for the whole track
const contacts: Contact[] = [];
let last = -Infinity;
for (const o of raw.onsets) {
  if (o.t - last < MIN_SPACING) continue;
  contacts.push({ t: o.t });
  last = o.t;
}

const spec: Spec = { duration: raw.range_s[1], contacts, sections: [{ t0: 0, t1: 56 }] };
export default spec;
