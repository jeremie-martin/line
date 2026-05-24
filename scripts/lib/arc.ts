/**
 * Arc spec — high-level creative control over a music-driven track's
 * energy flow. An Arc is a sequence of time-bounded ArcSections, each
 * with an intent that drives per-beat primitive choice:
 *
 *   descend  — drops; rider gains speed, lots of air
 *   level    — alternating drop / brake-slide; speed maintained
 *   climb    — kickers; rider goes up, bleeds speed
 *   freestyle — round-robin all primitives (visual variety, no energy bias)
 *
 * The Arc layer is purely a *spec* — it doesn't simulate. A strategy
 * consumes the Arc + a beat list and produces a list of Moves.
 *
 * Example: user's "descend for first half, climb in second half":
 *   [{ startSec: 0, endSec: 15, intent: "descend" },
 *    { startSec: 15, endSec: 30, intent: "climb" }]
 */
import { drop, slide, kicker, landUp, type Move } from "./moves.ts";

export type ArcIntent = "descend" | "level" | "climb" | "freestyle";

export type ArcSection = {
  startSec: number;
  endSec: number;
  intent: ArcIntent;
};

export type Arc = ArcSection[];

/**
 * Locate the section containing a given time (in seconds). Returns the
 * last section if the time is past the arc; the first if before.
 * Sections are assumed sorted and non-overlapping.
 */
export function sectionFor(arc: Arc, timeSec: number): ArcSection {
  if (arc.length === 0) throw new Error("sectionFor: empty arc");
  for (const s of arc) {
    if (timeSec >= s.startSec && timeSec < s.endSec) return s;
  }
  // Out-of-bounds: clamp to nearest end.
  return timeSec < arc[0].startSec ? arc[0] : arc[arc.length - 1];
}

/**
 * Choose a primitive Move for a single beat based on an arc intent.
 *
 *   descend  → always drop
 *   level    → alternates drop / slide (idx 0,1,3,4,6,7… = drop; 2,5,8… = slide)
 *   climb    → always kicker
 *   freestyle → round-robin drop / slide / kicker
 *
 * `idxInSection` is the move's 0-based position within its section; used
 * to drive the alternation pattern. Pass the global move index if you
 * don't care to reset per section — the alternation just shifts.
 */
export function primitiveForIntent(
  intent: ArcIntent,
  atFrame: number,
  idxInSection: number,
): Move {
  switch (intent) {
    case "descend":
      // Mostly drops, with a slide every 4th beat to bleed enough speed
      // that the NEXT section (climb / level) can place geometry without
      // pathological backtracking. Pure-drop chains build vx high enough
      // (30+ px/f after ~10 drops) that subsequent kickers can't find any
      // survivable placement — the greedy search then thrashes for thousands
      // of sims per stuck move.
      return (idxInSection + 1) % 4 === 0
        ? slide({ at: atFrame })
        : drop({ at: atFrame });
    case "level":
      // Every 3rd is a brake-slide.
      return (idxInSection + 1) % 3 === 0
        ? slide({ at: atFrame })
        : drop({ at: atFrame });
    case "climb":
      // Slides dominate (catch + absorb), kicker as spice every 4th beat.
      // landUp() exists as a bisected rising-curve primitive but isn't
      // wired in here: empirically, in the arc context the rider often
      // arrives at climb-section beats with too-high vy for landUp's
      // rising curve to catch without ejecting, and the bisection's
      // 18-iter search amplifies bench time without improving sync.
      // Use landUp directly when the upstream state is known-survivable
      // (e.g. immediately after a slow-down brake-slide).
      return (idxInSection + 1) % 4 === 0
        ? kicker({ at: atFrame })
        : slide({ at: atFrame });
    case "freestyle": {
      const cycle = idxInSection % 3;
      if (cycle === 0) return drop({ at: atFrame });
      if (cycle === 1) return slide({ at: atFrame });
      return kicker({ at: atFrame });
    }
  }
}

/**
 * Convert beat frames + an Arc into a list of (target, intent, idxInSection)
 * tuples ready to feed into iterativeStrategy.prepare(). Filters beats that
 * fall outside the arc, and applies a minimum spacing so the rider can
 * physically discharge between landings.
 */
export function planArcBeats(
  beatFrames: number[],
  arc: Arc,
  fps = 40,
  opts: { minFirstFrame?: number; minSpacingFrames?: number } = {},
): Array<{ target: number; intent: ArcIntent; idxInSection: number }> {
  const minFirst = opts.minFirstFrame ?? 30;
  const minSpacing = opts.minSpacingFrames ?? 15;
  const sorted = [...beatFrames].sort((a, b) => a - b);
  const out: Array<{ target: number; intent: ArcIntent; idxInSection: number }> = [];
  let last = -Infinity;
  // Track per-section running idx so alternation patterns reset per section.
  const sectionIdx = new Map<ArcSection, number>();
  for (const s of arc) sectionIdx.set(s, 0);

  for (const f of sorted) {
    if (f < minFirst) continue;
    if (f - last < minSpacing) continue;
    const t = f / fps;
    const sec = sectionFor(arc, t);
    const i = sectionIdx.get(sec) ?? 0;
    sectionIdx.set(sec, i + 1);
    out.push({ target: f, intent: sec.intent, idxInSection: i });
    last = f;
  }
  return out;
}
