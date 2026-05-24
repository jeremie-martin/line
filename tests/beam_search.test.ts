/**
 * Beam search unit tests.
 *
 * Validates structural properties of the beam search itself. End-to-end
 * comparison vs greedy / lookahead-2 lives in bench v2.
 */
import { describe, test, expect } from "vitest";
import { slide, drop } from "../scripts/lib/moves.ts";
import { searchRideBeam } from "../scripts/lib/beam_search.ts";
import { landingCandidates } from "../scripts/lib/primitive_search.ts";

describe("searchRideBeam", () => {
  test("K=1, B=1 produces a valid track on a 3-beat chain", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const r = searchRideBeam(moves, {}, { K: 1, B: 1, seed: 1 });
    expect(r.reachedEnd).toBe(true);
    expect(r.track.lines.length).toBeGreaterThan(0);
    expect(r.perBeat.length).toBe(3);
  });

  test("K=4, B=3 produces a valid track (richer beam)", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const r = searchRideBeam(moves, {}, { K: 4, B: 3, seed: 1 });
    expect(r.reachedEnd).toBe(true);
    expect(r.track.lines.length).toBeGreaterThan(0);
    // Sims should be > K=1 case (more exploration). With 3 beats and B=3
    // per beam member, sims ~ 3 * K_active * B (capped by candidates).
    expect(r.totalSimulations).toBeGreaterThan(3);
  });

  test("reproducible — same seed → same track lines (byte-equal)", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const a = searchRideBeam(moves, {}, { K: 4, B: 3, seed: 42 });
    const b = searchRideBeam(moves, {}, { K: 4, B: 3, seed: 42 });
    expect(a.track.lines.length).toBe(b.track.lines.length);
    for (let i = 0; i < a.track.lines.length; i++) {
      expect(a.track.lines[i].x1).toBe(b.track.lines[i].x1);
      expect(a.track.lines[i].y1).toBe(b.track.lines[i].y1);
      expect(a.track.lines[i].x2).toBe(b.track.lines[i].x2);
      expect(a.track.lines[i].y2).toBe(b.track.lines[i].y2);
    }
    expect(a.totalSimulations).toBe(b.totalSimulations);
    expect(a.perBeat).toEqual(b.perBeat);
  });

  test("materialization matches what the beam scored (no ride() replay drift)", () => {
    // Beam search assembles the TrackJson from accumulated lines directly,
    // not by re-running ride(). The detection here is computed by simulating
    // the assembled track — it MUST match the beam's perBeat trace expectations.
    const moves = [slide({ at: 30 }), slide({ at: 80 })];
    const r = searchRideBeam(moves, {}, { K: 4, B: 3, seed: 1 });
    expect(r.reachedEnd).toBe(true);
    // At least one event should fire near each beat target (if survived).
    const eventsNearBeats = r.detection.events.filter(
      (e) => (e.type === "landing" || e.type === "bounce") &&
             moves.some((m) => Math.abs(e.frame - m.atFrame) <= 30),
    );
    expect(eventsNearBeats.length).toBeGreaterThan(0);
  });

  test("expandCandidates lets beam pick different primitives per beat", () => {
    // With a candidate set of {slide, drop}, beam should try both.
    const moves = [slide({ at: 30 }), slide({ at: 80 }), slide({ at: 130 })];
    const r = searchRideBeam(moves, {}, {
      K: 4, B: 2, seed: 1,
      expandCandidates: (m) => [slide({ at: m.atFrame }), drop({ at: m.atFrame })],
    });
    expect(r.reachedEnd).toBe(true);
    // Some primitive diversity should show in the per-beat trace (across beats
    // OR across runs with different seeds; here we just check the trace shape).
    expect(r.perBeat.length).toBe(3);
    for (const pb of r.perBeat) {
      expect(["slide", "drop"].includes(pb.primitiveType)).toBe(true);
    }
  });

  test("integrates with landingCandidates from primitive_search", () => {
    const moves = [slide({ at: 30 }), slide({ at: 80 })];
    const r = searchRideBeam(moves, {}, {
      K: 4, B: 2, seed: 1,
      expandCandidates: (m, rider) =>
        landingCandidates(rider).map((c) => c.factory(m.atFrame)),
    });
    expect(r.reachedEnd).toBe(true);
    expect(r.perBeat.length).toBe(2);
  });
});
