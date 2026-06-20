/**
 * Single source of truth for the LOCKED production post-FX recipe.
 *
 * Chosen via scripts/fx_sweep.ts on luna_bala_44s: subtle impact shake + strong
 * chromatic aberration + subtle flash + faint recentered vignette. Imported by both
 * the production render (scripts/produce/render.ts) and the sweep tool
 * (scripts/fx_sweep.ts) so the shipped look can never drift from the validated one.
 *
 * The bottom-edge seam fix (BottomFade) is unconditional in the composition, not here.
 * Effects are time-based, so identical at any fps.
 */
export const LOCKED_FX = {
  shake: { maxPx: 10, maxRotDeg: 0.4, overscan: 1.04, freq: 9, decayPerSec: 7, gain: 1.6, minImpact: 0.22, power: 1.5 },
  chroma: { maxPx: 14, gain: 2.0, decayPerSec: 7, minImpact: 0.25, power: 1.4 },
  flash: { color: "#ffffff", maxOpacity: 0.3, gain: 1.8, decayPerSec: 12, minImpact: 0.3, blend: "screen" },
  vignette: { strength: 0.20, rx: 74, ry: 54, core: 68, cy: 36 },
} as const;
