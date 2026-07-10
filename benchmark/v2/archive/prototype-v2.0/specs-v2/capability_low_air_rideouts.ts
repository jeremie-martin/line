import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import type { Contact, Spec } from "../../scripts/v0/types.ts";

type RideoutContact = {
  t: number;
  role: "ordinary" | `rideout_entry_${string}` | `rideout_exit_${string}`;
};

type RideoutGrid = {
  schema: "line.benchmark-v2.rideout-motif.v1";
  duration_seconds: number;
  pulse_seconds: number;
  contacts: RideoutContact[];
};

const grid = JSON.parse(
  readFileSync(resolve("benchmark/v2/rhythms/low-air-rideouts.json"), "utf8"),
) as RideoutGrid;

const contacts: Contact[] = grid.contacts.map(({ t, role }) => ({
  t,
  impact: role.startsWith("rideout_exit") ? 0.86 : role.startsWith("rideout_entry") ? 0.42 : 0.58,
}));

const spec: Spec = {
  duration: grid.duration_seconds,
  contacts,
  axes: {
    air: keyframes([
      { t: 0, v: 0.28 },
      { t: 3.0, v: 0.06 },
      { t: 5.0, v: 0.28 },
      { t: 6.5, v: 0.05 },
      { t: 9.5, v: 0.28 },
      { t: 11.0, v: 0.03 },
      { t: 16.0, v: 0.28 },
    ], "hold"),
    speed: constant(0.72),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
