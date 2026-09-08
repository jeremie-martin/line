import { expect, it } from "vitest";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import type { Spec, TrackLine } from "../scripts/v0/types.ts";

const spec: Spec = { duration: 3, preroll: 5, jitter: 0,
  contacts: [.6, 1.2, 1.8, 2.4, 3].map(t => ({ t, impact: .4 })),
  axes: { air: () => .5, speed: () => .5 } };

function assertCurves(lines: TrackLine[]) {
  expect(lines.length).toBeGreaterThan(0);
  const groups = new Map<number, TrackLine[]>();
  for (const line of lines) {
    expect(line.type).toBe(0);
    const id = Math.floor((line.id - 1000) / 10000);
    groups.set(id, [...(groups.get(id) ?? []), line]);
  }
  for (const lines of groups.values()) {
    const chains: TrackLine[][] = [[]];
    for (const line of lines) {
      const previous = chains.at(-1)!.at(-1);
      if (previous && (previous.x2 !== line.x1 || previous.y2 !== line.y1)) chains.push([]);
      chains.at(-1)!.push(line);
    }
    expect(chains.length).toBeLessThanOrEqual(2);
    for (const chain of chains) {
      expect(chain.length).toBeGreaterThan(2);
      expect(chain.reduce((s, l) => s + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0)).toBeGreaterThan(10);
    }
  }
}

it("completes the physical contract with connected curves and reproducible metering", () => {
  const first = compileHandoff(spec, 17, { budget: 30000 });
  assertCurves(first.track.lines);
  expect(first.report.contacts.every(c => c.status === "hit")).toBe(true);
  expect(first.report.off_beat_landings).toHaveLength(0);
  expect(first.report.terminus.reason).toBe("endOfSpec");
  expect(first.stats.sim_frames).toBeLessThanOrEqual(30000);
  expect(first.stats.viable_candidate_samples).toBeGreaterThan(0);
  expect(first.stats.viable_candidate_samples).toBeLessThanOrEqual(first.stats.actual_candidate_samples!);
  expect(first.budgetTelemetry?.compile.total_spent_frames).toBe(first.stats.sim_frames);
  expect(first.budgetTelemetry?.compile.hard_overrun_frames).toBe(0);
  compileHandoff({ ...spec, start: { vx: 4.5, vy: 0, y: -160 } }, 18, { budget: 30000 });
  const repeated = compileHandoff(spec, 17, { budget: 30000, budgetTelemetry: "off" });
  expect(repeated.track).toEqual(first.track);
  expect(repeated.report).toEqual(first.report);
  expect(repeated.stats.sim_frames).toBe(first.stats.sim_frames);
  expect(repeated.budgetTelemetry).toBeNull();
});

it("uses seeded target variation without changing the authored report contract", () => {
  const varied = { ...spec, jitter: .02 };
  const a = compileHandoff(varied, 17, { budget: 30000 });
  const b = compileHandoff(varied, 18, { budget: 30000 });
  expect(a.track).not.toEqual(b.track);
  expect(a.report.gaps.map(g => Object.values(g.axes).map(a => a?.target)))
    .toEqual(b.report.gaps.map(g => Object.values(g.axes).map(a => a?.target)));
  assertCurves(a.track.lines);
  assertCurves(b.track.lines);
});
