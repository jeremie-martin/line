/**
 * Handoff comparison — variant B: ≥0.4s spacing filter for the FIRST 28s, then
 * every onset kept (the dense clusters intact) from 28s onward. Single no-axis
 * section so filtering is the only variable across the three comparison specs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";
import { constant } from "../core/curves.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const MIN_SPACING = 0.4; // seconds
const FILTER_END = 28; // seconds; spacing only enforced while t < FILTER_END
const contacts: Contact[] = [];
let last = -Infinity;
for (const o of raw.onsets) {
  if (o.t < FILTER_END && o.t - last < MIN_SPACING) continue;
  contacts.push({ t: o.t });
  last = o.t;
}

const spec: Spec = { duration: raw.range_s[1], contacts, sections: [{ t0: 0, t1: 56 }] };
export default spec;
