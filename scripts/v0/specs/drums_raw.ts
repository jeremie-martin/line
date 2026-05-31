/**
 * Handoff comparison — variant C: NO filtering at all. Every detected onset
 * (all 156, including the t≈0.02 spawn beat and every dense ~0.12s cluster)
 * becomes a hard Contact. Single no-axis section so filtering is the only
 * variable across the three comparison specs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Spec, Contact } from "../types.ts";

const raw = JSON.parse(
  readFileSync(resolve("beats/drums_0_56s_60_125.json"), "utf8"),
) as { range_s: [number, number]; onsets: { t: number }[] };

const contacts: Contact[] = raw.onsets.map((o) => ({ t: o.t }));

const spec: Spec = { duration: raw.range_s[1], contacts, axes: {} };
export default spec;
