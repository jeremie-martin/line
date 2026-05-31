import React from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";

// Phases from the madmom-derived spec (scripts/v0/specs/drums_0_56s_creative.ts).
// Boundaries = 4-bar phrase lines. Each axis carries TARGET (t) + MEASURED (m,
// achieved in generated/believer_v3.report.json) so the overlay shows both.
type Phase = {
  name: string;
  t0: number;
  t1: number;
  vibe: string;
  air: [number, number]; // [target, measured]
  speed: [number, number];
  grain: [number, number];
  color: string;
};

const DURATION_S = 56.55;

const PHASES: Phase[] = [
  { name: "INTRO", t0: 0, t1: 7.69, vibe: "restrained · grounded", air: [0.62, 0.67], speed: [0.55, 0.48], grain: [0.32, 0.29], color: "#5b8def" },
  { name: "BUILD", t0: 7.69, t1: 15.36, vibe: "lift begins", air: [0.7, 0.66], speed: [0.62, 0.7], grain: [0.4, 0.39], color: "#3fb6a8" },
  { name: "VERSE", t0: 15.36, t1: 30.74, vibe: "flowing · airy", air: [0.76, 0.74], speed: [0.7, 0.83], grain: [0.5, 0.43], color: "#7bd44b" },
  { name: "PRE-CHORUS", t0: 30.74, t1: 38.42, vibe: "coil · winding up", air: [0.68, 0.68], speed: [0.75, 0.54], grain: [0.45, 0.38], color: "#f0b429" },
  { name: "CHORUS", t0: 38.42, t1: 53.78, vibe: "peak · high air · big ramps", air: [0.8, 0.75], speed: [0.9, 1.02], grain: [0.6, 0.51], color: "#f24f4f" },
  { name: "OUTRO", t0: 53.78, t1: DURATION_S, vibe: "release", air: [0.64, 0.66], speed: [0.85, 1.3], grain: [0.62, 0.65], color: "#a06cf2" },
];

const FONT = "ui-monospace, 'DejaVu Sans Mono', 'IBM Plex Mono', monospace";
const PILL = "rgba(10,12,18,0.86)";
const BORDER = "1px solid rgba(255,255,255,0.10)";

const AxisBar: React.FC<{
  label: string;
  target: number;
  measured: number;
  color: string;
  reveal: number;
}> = ({ label, target, measured, color, reveal }) => {
  const fill = interpolate(reveal, [0, 1], [0, Math.min(measured, 1) * 100], { extrapolateRight: "clamp" });
  const tick = Math.min(target, 1) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 18, color: "#fff" }}>
      <span style={{ width: 52, color: "#c2c9d8", letterSpacing: 1 }}>{label}</span>
      <div style={{ position: "relative", width: 104, height: 8, background: "rgba(255,255,255,0.16)", borderRadius: 4 }}>
        <div style={{ width: `${fill}%`, height: "100%", background: "#fff", borderRadius: 4 }} />
        {/* target tick (color-matched to the target number) */}
        <div style={{ position: "absolute", left: `${tick}%`, top: -3, width: 3, height: 14, background: color, borderRadius: 1, transform: "translateX(-1px)" }} />
      </div>
      <span style={{ width: 86, whiteSpace: "nowrap", textAlign: "right" }}>
        <span style={{ color: "#fff", fontWeight: 600 }}>{measured.toFixed(2)}</span>
        <span style={{ color, fontSize: 15 }}> / {target.toFixed(2)}</span>
      </span>
    </div>
  );
};

export const PhaseOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  let idx = PHASES.findIndex((p) => t >= p.t0 && t < p.t1);
  if (idx < 0) idx = PHASES.length - 1;
  const phase = PHASES[idx];

  const since = frame - phase.t0 * fps;
  const enter = spring({ frame: since, fps, config: { damping: 18, mass: 0.6 } });
  const cardY = interpolate(enter, [0, 1], [70, 0]);
  const chipReveal = spring({ frame: since - 6, fps, config: { damping: 20 } });

  const M = 80;
  const TL_W = width - 2 * M;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile("source.mp4")} />

      {/* top-left: title pill */}
      <div
        style={{
          position: "absolute", top: 40, left: M, display: "flex", alignItems: "center", gap: 14,
          background: PILL, border: BORDER, borderRadius: 12, padding: "12px 22px", fontFamily: FONT,
        }}
      >
        <span style={{ fontSize: 26, fontWeight: 600, color: "#fff", letterSpacing: 2 }}>BELIEVER</span>
        <span style={{ fontSize: 22, color: "#8b93a7", letterSpacing: 1 }}>IMAGINE DRAGONS</span>
        <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.18)" }} />
        <span style={{ fontSize: 22, color: "#aeb6c7", letterSpacing: 1 }}>125 BPM · 4/4</span>
      </div>

      {/* top-right: section badge */}
      <div
        style={{
          position: "absolute", top: 40, right: M, display: "flex", alignItems: "center", gap: 12,
          background: PILL, border: `1px solid ${phase.color}`, borderRadius: 12, padding: "12px 20px", fontFamily: FONT,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 6, background: phase.color }} />
        <span style={{ fontSize: 24, color: "#fff", letterSpacing: 2, fontWeight: 600 }}>
          §{idx + 1} / {PHASES.length}
        </span>
      </div>

      {/* lower-third card — solid dark, measured(white) vs target(color) per axis */}
      <div
        style={{
          position: "absolute", left: M, bottom: 120, transform: `translateY(${cardY}px)`, opacity: enter,
          display: "flex", gap: 16, backgroundColor: "rgba(9,11,16,0.90)", border: BORDER, borderRadius: 13,
          padding: "15px 26px 15px 16px",
        }}
      >
        <div style={{ width: 5, borderRadius: 3, background: phase.color }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <div style={{ fontFamily: FONT, fontSize: 38, fontWeight: 700, color: "#fff", letterSpacing: 2, lineHeight: 1 }}>
              {phase.name}
            </div>
            <div style={{ fontFamily: FONT, fontSize: 14, color: "#8b93a7", letterSpacing: 1 }}>
              measured <span style={{ color: "#fff" }}>■</span> / target <span style={{ color: phase.color }}>▏</span>
            </div>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 18, color: "#aeb6c7" }}>
            {phase.t0.toFixed(1)}–{phase.t1.toFixed(1)}s · {phase.vibe}
          </div>
          <div style={{ display: "flex", gap: 40, marginTop: 5 }}>
            <AxisBar label="AIR" target={phase.air[0]} measured={phase.air[1]} color={phase.color} reveal={chipReveal} />
            <AxisBar label="SPEED" target={phase.speed[0]} measured={phase.speed[1]} color={phase.color} reveal={chipReveal} />
            <AxisBar label="GRAIN" target={phase.grain[0]} measured={phase.grain[1]} color={phase.color} reveal={chipReveal} />
          </div>
        </div>
      </div>

      {/* bottom phase timeline */}
      <div
        style={{
          position: "absolute", left: M - 10, right: M - 10, bottom: 46, height: 18,
          background: PILL, border: BORDER, borderRadius: 9,
        }}
      >
        <div style={{ position: "absolute", left: 10, top: 5, width: TL_W, height: 8 }}>
          {PHASES.map((p, i) => {
            const x = (p.t0 / DURATION_S) * TL_W;
            const w = ((p.t1 - p.t0) / DURATION_S) * TL_W;
            const active = i === idx;
            return (
              <div
                key={p.name}
                style={{
                  position: "absolute", left: x + 1, width: Math.max(0, w - 2), height: 8,
                  background: active ? p.color : "rgba(255,255,255,0.22)", borderRadius: 3,
                }}
              />
            );
          })}
          <div
            style={{
              position: "absolute", left: (t / DURATION_S) * TL_W - 1, top: -5, width: 2, height: 18,
              background: "#fff", boxShadow: "0 0 6px rgba(255,255,255,0.9)",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
