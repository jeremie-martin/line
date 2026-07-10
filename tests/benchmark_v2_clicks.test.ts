import { describe, expect, test } from "vitest";
import { encodeClickTrack } from "../scripts/v0/benchmark_v2/click_model.ts";
import type { Spec } from "../scripts/v0/types.ts";

describe("Benchmark V2 click-track renderer", () => {
  test("writes a mono 44.1kHz PCM WAV with audible samples", () => {
    const spec: Spec = {
      duration: 1,
      contacts: [{ t: 0.25, impact: 0.9 }, { t: 0.75, impact: 0.3 }],
      axes: {},
    };
    const wav = encodeClickTrack(spec);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44_100);
    expect(wav.subarray(44).some((byte) => byte !== 0)).toBe(true);
  });
});
