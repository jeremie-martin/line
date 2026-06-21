/**
 * Post-FX harness for the production overlay (CurveOverlayVertical).
 *
 * The ride is a pre-rendered, opaque mp4; Remotion composites on top. So every
 * effect here is a CHEAP post layer over the existing <name>.source.mp4 — no ride
 * re-render. This lets us sweep dozens of looks (camera shake, chromatic
 * aberration, grade, vignette, flash, color tint) by varying --props alone.
 *
 * Impact-driven effects read the SAME landing/impact times the ride's beat-punch
 * uses (overlay.json `contacts`, magnitude = impactRedir ?? impact), via a simple
 * decaying "trauma" accumulator — so shake/chroma/flash land on the felt slams.
 *
 * All `fx`-driven effects default OFF/identity: with no `fx` prop, RideFX/TintLayer/
 * VignetteLayer/FlashLayer are no-ops. (BottomFade is a separate, always-on seam fix
 * applied by the composition regardless of `fx`.)
 */
import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";

// ── config ───────────────────────────────────────────────────────────────────
export type ShakeFX = {
  maxPx: number;        // peak translation (px) at trauma=1
  maxRotDeg: number;    // peak rotation (deg) at trauma=1
  overscan: number;     // video scale so shake/rotate never reveals frame edges
  freq: number;         // shake oscillation frequency (Hz)
  decayPerSec: number;  // trauma decay rate (larger = snappier)
  gain: number;         // impact-strength → trauma multiplier
  minImpact: number;    // ignore impacts weaker than this
  power: number;        // trauma exponent (1 linear, 2 = punchy/quiet-between-hits)
};
export type ChromaFX = {
  maxPx: number; decayPerSec: number; gain: number; minImpact: number; power: number;
  baseline: number;     // constant RGB split even between hits (px)
};
export type GradeFX = {
  contrast: number; saturate: number; brightness: number;
};
export type TintFX = {
  color: string;        // used when byPhase=false
  byPhase: boolean;     // drive the tint color from the active phase color
  opacity: number;
  blend: string;        // multiply | screen | overlay | soft-light | color
};
export type VignetteFX = {
  strength: number;     // edge darkness 0..1
  rx: number;           // ellipse horizontal radius, % of frame WIDTH (50 = touches L/R edge)
  ry: number;           // ellipse vertical radius, % of frame HEIGHT (50 = touches top/bottom)
  core: number;         // inner transparent fraction of the ellipse (%) before the fade starts
  cx: number;           // ellipse center X, % of frame width
  cy: number;           // ellipse center Y, % of frame height (rider sits ~36% — above center)
  pulse: number;        // extra strength added with trauma
};
export type FlashFX = {
  color: string; maxOpacity: number; decayPerSec: number; gain: number; minImpact: number; blend: string;
};
export type FXConfig = {
  shake?: Partial<ShakeFX>;
  chroma?: Partial<ChromaFX>;
  grade?: Partial<GradeFX>;
  tint?: Partial<TintFX>;
  vignette?: Partial<VignetteFX>;
  flash?: Partial<FlashFX>;
};

// Impact magnitudes (impactRedir) typically run ~0.2–0.45, so gates sit low and
// gain lifts a single hit toward a satisfying trauma; clustered hits stack to 1.
export const SHAKE_DEFAULT: ShakeFX = {
  maxPx: 16, maxRotDeg: 0.6, overscan: 1.05, freq: 11, decayPerSec: 6, gain: 1.8, minImpact: 0.22, power: 1.5,
};
export const CHROMA_DEFAULT: ChromaFX = {
  maxPx: 7, decayPerSec: 7, gain: 1.8, minImpact: 0.25, power: 1.5, baseline: 0,
};
export const GRADE_DEFAULT: GradeFX = { contrast: 1, saturate: 1, brightness: 1 };
export const TINT_DEFAULT: TintFX = { color: "#1b2a4a", byPhase: false, opacity: 0.0, blend: "multiply" };
// Wide-and-soft by default: rx 72% / ry 52% with a big transparent core makes a
// broad oval whose clear zone reaches the L/R edges, darkening only the top/bottom.
export const VIGNETTE_DEFAULT: VignetteFX = { strength: 0, rx: 72, ry: 52, core: 65, cx: 50, cy: 36, pulse: 0 };
export const FLASH_DEFAULT: FlashFX = { color: "#ffffff", maxOpacity: 0, decayPerSec: 9, gain: 1.8, minImpact: 0.3, blend: "screen" };

// ── impact "trauma" model ──────────────────────────────────────────────────────
type Contact = { t: number; impact: number | null; impactRedir?: number | null };
export const impactStrength = (c: Contact): number => (c.impactRedir ?? c.impact ?? 0);

/** Decaying, clamped accumulator of recent impacts at time `t` (s), then raised to
 *  `power`. Returns 0..1. Clustered hits stack (capped at 1). */
export function traumaAt(
  t: number, contacts: Contact[],
  { decayPerSec, gain, minImpact, power }: { decayPerSec: number; gain: number; minImpact: number; power: number },
): number {
  let tr = 0;
  for (const c of contacts) {
    const s = impactStrength(c);
    if (c.t > t || s < minImpact) continue;
    tr += s * gain * Math.exp(-(t - c.t) * decayPerSec);
  }
  return Math.pow(Math.min(1, tr), power);
}

// ── the ride video, with shake + chroma + grade applied ─────────────────────────
export const RideFX: React.FC<{
  videoFile: string; shiftPx: number; t: number; contacts: Contact[]; fx: FXConfig;
}> = ({ videoFile, shiftPx, t, contacts, fx }) => {
  const shake = fx.shake ? { ...SHAKE_DEFAULT, ...fx.shake } : null;
  const chroma = fx.chroma ? { ...CHROMA_DEFAULT, ...fx.chroma } : null;
  const grade = fx.grade ? { ...GRADE_DEFAULT, ...fx.grade } : null;

  // shake transform
  let dx = 0, dy = 0, rot = 0, scale = 1;
  if (shake) {
    const m = traumaAt(t, contacts, shake);
    const w = 2 * Math.PI;
    dx = shake.maxPx * m * Math.sin(w * shake.freq * t + 0.0);
    dy = shake.maxPx * m * Math.sin(w * shake.freq * 1.37 * t + 1.7);
    rot = shake.maxRotDeg * m * Math.sin(w * shake.freq * 0.9 * t + 3.1);
    scale = shake.overscan;
  }

  // chromatic-aberration split amount (px)
  let split = 0;
  if (chroma) {
    const m = traumaAt(t, contacts, chroma);
    split = chroma.baseline + chroma.maxPx * m;
  }

  // CSS filter string: chroma (SVG ref) + grade functions
  const parts: string[] = [];
  if (split > 0.01) parts.push("url(#ride-chroma)");
  if (grade) parts.push(`contrast(${grade.contrast}) saturate(${grade.saturate}) brightness(${grade.brightness})`);
  const filter = parts.length ? parts.join(" ") : undefined;

  return (
    <AbsoluteFill style={{ transform: `translateY(${-shiftPx}px)` }}>
      {split > 0.01 && (
        // SVG filter rebuilt each frame with the current split: offset the red
        // channel +x and blue -x, screen-recombine. White areas (the ride bg) have
        // equal RGB so they stay white; fringing appears only on the black lines.
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <defs>
            <filter id="ride-chroma" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
              <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
              <feOffset in="r" dx={split} dy={0} result="ro" />
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
              <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
              <feOffset in="b" dx={-split} dy={0} result="bo" />
              <feBlend in="ro" in2="g" mode="screen" result="rg" />
              <feBlend in="rg" in2="bo" mode="screen" />
            </filter>
          </defs>
        </svg>
      )}
      <AbsoluteFill
        style={{
          transform: `scale(${scale}) translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
          transformOrigin: "center center",
          filter,
        }}
      >
        <OffthreadVideo src={staticFile(videoFile)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ── full-frame color tint (kills the flat white; can track the phase color) ──────
export const TintLayer: React.FC<{ fx: FXConfig; phaseColor?: string; enter: number }> = ({ fx, phaseColor, enter }) => {
  if (!fx.tint) return null;
  const cfg = { ...TINT_DEFAULT, ...fx.tint };
  if (cfg.opacity <= 0) return null;
  const color = cfg.byPhase ? (phaseColor ?? cfg.color) : cfg.color;
  return (
    <AbsoluteFill
      style={{ backgroundColor: color, opacity: cfg.opacity * enter, mixBlendMode: cfg.blend as React.CSSProperties["mixBlendMode"] }}
    />
  );
};

// ── vignette (static + optional impact pulse) ───────────────────────────────────
export const VignetteLayer: React.FC<{ fx: FXConfig; t: number; contacts: Contact[]; enter: number }> = ({ fx, t, contacts, enter }) => {
  if (!fx.vignette) return null;
  const cfg = { ...VIGNETTE_DEFAULT, ...fx.vignette };
  // reuse the shake trauma shape (the SHAKE_DEFAULT params) for the pulse term, so the
  // two share one definition of "felt slam". Gate/gain match the impact scale (~0.2–0.45)
  // so the pulse actually fires; a minImpact of 0.45 would exceed every real impact and
  // make the pulse silently dead.
  const { decayPerSec, gain, minImpact, power } = SHAKE_DEFAULT;
  const pulse = cfg.pulse > 0 ? cfg.pulse * traumaAt(t, contacts, { decayPerSec, gain, minImpact, power }) : 0;
  const strength = Math.min(1, cfg.strength + pulse);
  if (strength <= 0) return null;
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse ${cfg.rx}% ${cfg.ry}% at ${cfg.cx}% ${cfg.cy}%, rgba(0,0,0,0) ${cfg.core}%, rgba(0,0,0,${strength}) 100%)`,
        opacity: enter,
      }}
    />
  );
};

// ── bottom-edge fade ────────────────────────────────────────────────────────────
// The ride video is shifted UP (to free the lower band for the spectrum), so its
// bottom edge meets the white background ~87% down and reads as a faint horizontal
// seam — worsened by overscan/shake. This melts that edge into white. Screen-space,
// so it stays put under the shake; placed BELOW tint/vignette so the bottom still
// grades/darkens uniformly with no visible seam.
export const BottomFade: React.FC<{ startPct?: number; endPct?: number }> = ({ startPct = 80, endPct = 85 }) => (
  <AbsoluteFill
    style={{ background: `linear-gradient(to bottom, rgba(255,255,255,0) ${startPct}%, rgba(255,255,255,1) ${endPct}%)`, pointerEvents: "none" }}
  />
);

// ── full-frame impact flash ─────────────────────────────────────────────────────
export const FlashLayer: React.FC<{ fx: FXConfig; t: number; contacts: Contact[] }> = ({ fx, t, contacts }) => {
  if (!fx.flash) return null;
  const cfg = { ...FLASH_DEFAULT, ...fx.flash };
  if (cfg.maxOpacity <= 0) return null;
  const env = traumaAt(t, contacts, { decayPerSec: cfg.decayPerSec, gain: cfg.gain, minImpact: cfg.minImpact, power: 1 });
  const op = cfg.maxOpacity * env;
  if (op <= 0.003) return null;
  return (
    <AbsoluteFill
      style={{ backgroundColor: cfg.color, opacity: op, mixBlendMode: cfg.blend as React.CSSProperties["mixBlendMode"] }}
    />
  );
};
