import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  applySpecDashboardEdit,
  buildSpecDashboardSourceIndex,
} from "../scripts/spec_dashboard_source.ts";

const sampleSpec = `
import { keyframes } from "../core/curves.ts";

const speed = keyframes([
  { t: 0, v: 0.34 },
  { t: 1, v: 0.56, ease: "smooth" },
]);

const contacts = [
  { t: 0.5 },
  { t: 1.0, impact: 0.25 },
  { t: 1.5, impact: impactFor(1.5) },
];

const spec = {
  duration: 2,
  camera: {
    zoom: {
      keyframes: [
        { t: 0, zoom: 2.8 },
        { t: 1, zoom: 1.7 },
      ],
    },
  },
  contacts,
  axes: {
    air: keyframes([{ t: 0, v: 0.42 }, { t: 1, v: 0.76 }], "smooth"),
    speed,
    amplitude: (t) => t < 1 ? 0.1 : 0.4,
  },
};

export default spec;
`;

describe("spec dashboard source edits", () => {
  test("indexes only source-literal editable marks", () => {
    const index = buildSpecDashboardSourceIndex(sampleSpec);

    expect(index.axisKeyframes.get("air:0")?.id).toBe("axis:air:0");
    expect(index.axisKeyframes.get("speed:1")?.id).toBe("axis:speed:1");
    expect(index.axisKeyframes.has("amplitude:0")).toBe(false);
    expect(index.zoomKeyframes.get(1)?.id).toBe("zoom:1");
    expect(index.contactImpacts.get(1)?.id).toBe("contact:1");
    expect(index.contactImpacts.has(2)).toBe(false);
  });

  test("applies literal keyframe, zoom, and impact edits", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-dashboard-source-"));
    const file = join(dir, "spec.ts");
    writeFileSync(file, sampleSpec);

    applySpecDashboardEdit(file, {
      editKind: "axisKeyframe",
      id: "axis:air:0",
      t: 0.25,
      value: 0.55,
      ease: "easeOut",
    });
    applySpecDashboardEdit(file, {
      editKind: "axisKeyframe",
      id: "axis:speed:1",
      t: 1.1,
      value: 0.62,
      ease: null,
    });
    applySpecDashboardEdit(file, {
      editKind: "zoomKeyframe",
      id: "zoom:1",
      t: 1.25,
      value: 2.25,
    });
    applySpecDashboardEdit(file, {
      editKind: "contactImpact",
      id: "contact:1",
      impact: 0.75,
    });

    const next = readFileSync(file, "utf8");
    expect(next).toContain("{ t: 0.25, v: 0.55, ease: \"easeOut\" }");
    expect(next).toContain("{ t: 1.1, v: 0.62 }");
    expect(next).toContain("{ t: 1.25, zoom: 2.25 }");
    expect(next).toContain("{ t: 1.0, impact: 0.75 }");
  });

  test("rejects generated impact edits", () => {
    const dir = mkdtempSync(join(tmpdir(), "spec-dashboard-source-"));
    const file = join(dir, "spec.ts");
    writeFileSync(file, sampleSpec);

    expect(() => applySpecDashboardEdit(file, {
      editKind: "contactImpact",
      id: "contact:2",
      impact: 0.9,
    })).toThrow(/available.*editable|not.*available|not.*editable/i);
  });
});
