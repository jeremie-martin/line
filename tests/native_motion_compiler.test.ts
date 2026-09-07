import { expect, it } from "vitest";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import type { Spec } from "../scripts/v0/types.ts";
import { scheduleNativeContacts } from "../scripts/v0/optimizer/native_motion_schedule.ts";
const spec: Spec = { duration: 2, preroll: 5, jitter: 0,
  contacts: [0.5, 1, 1.5, 2].map(t => ({ t, impact: 0.5 })),
  axes: { air: () => 0.5, speed: () => 0.5, amplitude: () => 0.1 } };

it("physically completes a final-frame contact and preserves deterministic compile state", () => {
  const first = compileHandoff(spec, 17, { budget: 25000 });
  expect(first.report.contacts.every(c => c.status === "hit")).toBe(true);
  expect(first.report.off_beat_landings).toHaveLength(0);
  expect(first.report.terminus.reason).toBe("endOfSpec");
  expect(first.stats.sim_frames).toBeLessThanOrEqual(25000);
  expect(first.budgetTelemetry?.compile.total_spent_frames).toBe(first.stats.sim_frames);
  const manual = compileHandoff({ ...spec, start: { vx: 4.5, vy: 0, y: -160 } }, 18, { budget: 25000 });
  expect(manual.track.startPosition).toEqual({ x: 0, y: -160 });
  expect(manual.track.riders[0].startVelocity).toEqual({ x: 4.5, y: 0 });
  const repeated = compileHandoff(spec, 17, { budget: 25000, budgetTelemetry: "off",
    searchPolicyBudget: undefined, repairBudget: undefined, resumePolicy: undefined });
  expect(repeated.track).toEqual(first.track);
  expect(repeated.report).toEqual(first.report);
  expect(repeated.stats.sim_frames).toBe(first.stats.sim_frames);
  expect(repeated.budgetTelemetry).toBeNull();
});

it("stays within a smaller actual physics budget", () => {
  const result = compileHandoff(spec, 17, { budget: 3500 });
  expect(result.stats.sim_frames).toBeLessThanOrEqual(3500);
  expect(result.budgetTelemetry?.compile.hard_overrun_frames).toBe(0);
});

it("uses only the existing contact tolerance to make a short pickup persistent", () => {
  const authored = [20, 28, 50].map((endFrame, index, frames) => ({ index,
    startFrame: index ? frames[index - 1] : 0, endFrame, endsWithContact: true, targets: { air: 0.2 } }));
  const scheduled = scheduleNativeContacts(authored);
  expect(scheduled.every((g, i) => Math.abs(g.endFrame - authored[i].endFrame) <= 1)).toBe(true);
  expect(scheduled.every(g => g.endFrame - g.startFrame >= 9)).toBe(true);
  expect(authored[1].endFrame).toBe(28);
});
