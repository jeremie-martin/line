import { afterEach, expect, it, vi } from "vitest";
import { handoffBackend } from "../scripts/v0/optimizer/handoff.ts";
import type { Spec } from "../scripts/v0/types.ts";

const spec: Spec = { duration: 3, jitter: 0, contacts: [{ t: 1 }],
  axes: { air: () => .5, speed: () => .5 } };
afterEach(() => vi.unstubAllEnvs());

it("routes ordinary production and telemetry requests to coherent arcs", () => {
  vi.stubEnv("LR_ENGINE", "wasm");
  expect(handoffBackend(spec, { budget: 30000 })).toBe("arcs");
  expect(handoffBackend(spec, { budget: 30000, budgetTelemetry: "off", polish: undefined })).toBe("arcs");
});

it("preserves diagnostic options, even explicit false, for legacy studies", () => {
  vi.stubEnv("LR_ENGINE", "wasm");
  expect(handoffBackend(spec, { budget: 30000, polish: false })).toBe("legacy");
  expect(handoffBackend(spec, { budget: 30000, maxNodes: 20 })).toBe("legacy");
});

it("preserves fallback for early contacts, empty timelines and tiny allowances", () => {
  vi.stubEnv("LR_ENGINE", "wasm");
  expect(handoffBackend({ ...spec, contacts: [{ t: .1 }] }, { budget: 30000 })).toBe("legacy");
  expect(handoffBackend({ ...spec, contacts: [] }, { budget: 30000 })).toBe("legacy");
  expect(handoffBackend(spec, { budget: 200 })).toBe("legacy");
});

it("keeps reference engines on the compatible legacy path", () => {
  for (const engine of ["js", "official"]) {
    vi.stubEnv("LR_ENGINE", engine);
    expect(handoffBackend(spec, { budget: 30000 })).toBe("legacy");
  }
});
