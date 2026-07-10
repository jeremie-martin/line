import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import type { Contact, Spec } from "../../scripts/v0/types.ts";

type PickupMotif = {
  primary_seconds: number;
  pickup_offsets_seconds: number[];
  suppress_primary_seconds: number[];
};

type PickupGrid = {
  schema: "line.benchmark-v2.pickup-motif.v1";
  duration_seconds: number;
  pulse_seconds: number;
  first_primary_seconds: number;
  last_primary_seconds: number;
  motifs: PickupMotif[];
};

const grid = JSON.parse(
  readFileSync(resolve("benchmark/v2/rhythms/short-pickups.json"), "utf8"),
) as PickupGrid;

const suppressed = new Set(grid.motifs.flatMap((motif) => motif.suppress_primary_seconds));
const motifPrimaries = new Set(grid.motifs.map((motif) => motif.primary_seconds));
const pickupTimes = new Set(grid.motifs.flatMap((motif) =>
  motif.pickup_offsets_seconds.map((offset) => rounded(motif.primary_seconds + offset))
));
const primaryTimes: number[] = [];
for (
  let t = grid.first_primary_seconds;
  t <= grid.last_primary_seconds + 1e-9;
  t += grid.pulse_seconds
) {
  const time = rounded(t);
  if (!suppressed.has(time)) primaryTimes.push(time);
}

const contacts: Contact[] = [...new Set([...primaryTimes, ...pickupTimes])]
  .sort((a, b) => a - b)
  .map((t) => ({
    t,
    impact: pickupTimes.has(t) ? 0.32 : motifPrimaries.has(t) ? 0.9 : 0.58,
  }));

const spec: Spec = {
  duration: grid.duration_seconds,
  contacts,
  axes: {
    air: keyframes([
      { t: 0, v: 0.32 },
      { t: 4.8, v: 0.18 },
      { t: 7.2, v: 0.32 },
      { t: 10.8, v: 0.14 },
      { t: 13.2, v: 0.32 },
      { t: 16.8, v: 0.10 },
      { t: 19.2, v: 0.30 },
    ], "hold"),
    speed: keyframes([
      { t: 0, v: 0.68 },
      { t: 4.8, v: 0.76 },
      { t: 10.8, v: 0.80 },
      { t: 16.8, v: 0.84 },
      { t: 19.2, v: 0.72 },
    ], "smooth"),
  },
  jitter: 0,
  preroll: 5,
};

function rounded(value: number): number {
  return Number(value.toFixed(3));
}

export default spec;
