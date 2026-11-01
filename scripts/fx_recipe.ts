/**
 * Single source of truth for the LOCKED production post-FX recipe.
 *
 * Impact shake, chromatic aberration and flash retain the established look.
 * The static soft-base vignette was owner-selected in the November 2026 style
 * review: a faint bottom wash and a trace at the top, without pulsing or entrance.
 * Used by the shared production renderer (scripts/produce/render.ts).
 *
 * The bottom-edge seam fix (BottomFade) is unconditional in the composition, not here.
 * Effects are time-based, so identical at any fps.
 */
export const LOCKED_FX = {
  shake: { maxPx: 10, maxRotDeg: 0.4, overscan: 1.04, freq: 9, decayPerSec: 7, gain: 1.6, minImpact: 0.22, power: 1.5 },
  chroma: { maxPx: 14, gain: 2.0, decayPerSec: 7, minImpact: 0.25, power: 1.4 },
  flash: { color: "#ffffff", maxOpacity: 0.3, gain: 1.8, decayPerSec: 12, minImpact: 0.3, blend: "screen" },
  vignette: { style: "soft-base" },
} as const;
