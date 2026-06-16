import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  interpolateColors,
  spring,
  delayRender,
  continueRender,
  getInputProps,
} from "remotion";

// ── Data bundle (written by scripts/make_overlay_data.ts) ────────────────────
type Pt = { t: number; v: number };
type Measured = { t: number; target: number; achieved: number; error: number };
type AxisData = { axis: string; label: string; color: string; target: Pt[]; measured: Measured[] };
type Phase = { name: string; t0: number; t1: number; color: string };
type Bundle = {
  title: string; artist: string; tempo: string;
  durationS: number; fps: number;
  score: number; axisRms: number;
  contactsHit: number; contactsTotal: number; offBeat: number; reachedEnd: boolean;
  axes: AxisData[];
  contacts: {
    t: number; landed: boolean; impact: number | null;
    impactTarget?: number | null; impactAchieved?: number | null; impactError?: number | null;
    impactWindow?: number | null; impactRedir?: number | null; impactSnap?: number | null; impactJolt?: number | null;
    impactWhip?: number | null; impactComDecel?: number | null;
    impactDeform?: number | null; impactRot?: number | null;
    impactTurn?: number | null; impactDv?: number | null;
  }[];
  phases: Phase[];
};

const FONT = "ui-monospace, 'DejaVu Sans Mono', 'IBM Plex Mono', monospace";
const PILL = "rgba(10,12,18,0.86)";
const BORDER = "1px solid rgba(255,255,255,0.10)";

// Axis value domain mapped to the full chart height (most values live 0.3–0.95;
// 0.15 floor gives the curves room to read without wasting vertical space).
const Y_MIN = 0.15;
const Y_MAX = 1.0;

// Left gutter (axis label + readout) and right pad, shared by the charts and the
// playhead/phase-band time mapping so they stay pixel-aligned.
const CHART_PAD_L = 90;
const CHART_PAD_R = 14;

// Per-chart sizing. Defaults reproduce the landscape (1920x1080) overlay exactly;
// the vertical composition passes a larger set so labels/readouts/curves scale up.
type ChartSizing = {
  padL: number; padR: number;
  labelX: number; labelY: number; labelSize: number;
  readoutY: number; readoutSize: number; readoutSubSize: number;
  dotR: number; liveDotR: number; strokeW: number;
  impactBarW: number; impactTickHalf: number; impactHead: number;
};
const DEFAULT_SIZING: ChartSizing = {
  padL: CHART_PAD_L, padR: CHART_PAD_R,
  labelX: 12, labelY: 24, labelSize: 18,
  readoutY: 48, readoutSize: 19, readoutSubSize: 16,
  dotR: 2.4, liveDotR: 5, strokeW: 2.5,
  impactBarW: 4, impactTickHalf: 6, impactHead: 30,
};

// ── one axis chart: full target curve + revealing measured dots + error stems ─
const AxisChart: React.FC<{
  data: AxisData;
  w: number;
  h: number;
  durationS: number;
  t: number;
  sizing?: Partial<ChartSizing>;
}> = ({ data, w, h, durationS, t, sizing }) => {
  const S = { ...DEFAULT_SIZING, ...sizing };
  const padL = S.padL; // room for the label + numeric readout
  const padR = S.padR;
  const plotW = w - padL - padR;
  const x = (tt: number) => padL + (tt / durationS) * plotW;
  const y = (v: number) => h - ((Math.min(Y_MAX, Math.max(Y_MIN, v)) - Y_MIN) / (Y_MAX - Y_MIN)) * h;

  // full authored target curve (the plan, shown ahead of the playhead)
  const targetPath = data.target.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  // soft fill under the target curve
  const areaPath =
    `${targetPath} L${x(data.target[data.target.length - 1].t).toFixed(1)},${h} L${x(data.target[0].t).toFixed(1)},${h} Z`;

  const revealed = data.measured.filter((m) => m.t <= t);
  const measuredLine = revealed.map((m, i) => `${i === 0 ? "M" : "L"}${x(m.t).toFixed(1)},${y(m.achieved).toFixed(1)}`).join(" ");

  // current readout = most recent landed gap at/just before the playhead
  const cur = revealed.length ? revealed[revealed.length - 1] : null;
  const playX = x(Math.min(t, durationS));

  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {/* baseline grid */}
      <line x1={padL} y1={h - 0.5} x2={w - padR} y2={h - 0.5} stroke="rgba(255,255,255,0.10)" />

      {/* target area + line */}
      <path d={areaPath} fill={data.color} opacity={0.07} />
      <path d={targetPath} fill="none" stroke={data.color} strokeWidth={S.strokeW} opacity={0.92} />

      {/* measured connecting line + dots (revealed) */}
      <path d={measuredLine} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={S.strokeW * 0.6} />
      {revealed.map((m, i) => (
        <circle key={i} cx={x(m.t)} cy={y(m.achieved)} r={S.dotR} fill="#fff" opacity={0.9} />
      ))}

      {/* playhead + live dot */}
      <line x1={playX} y1={0} x2={playX} y2={h} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {cur && <circle cx={x(cur.t)} cy={y(cur.achieved)} r={S.liveDotR} fill="#fff" stroke={data.color} strokeWidth={2} />}

      {/* label + numeric readout (measured / target) */}
      <text x={S.labelX} y={S.labelY} fontFamily={FONT} fontSize={S.labelSize} fontWeight={700} fill={data.color} letterSpacing={1}>
        {data.label}
      </text>
      {cur && (
        <text x={S.labelX} y={S.readoutY} fontFamily={FONT} fontSize={S.readoutSize} fill="#fff">
          {cur.achieved.toFixed(2)}
          <tspan fill={data.color} fontSize={S.readoutSubSize}> / {cur.target.toFixed(2)}</tspan>
        </text>
      )}
    </svg>
  );
};

// ── beat-impact row (creative default): colored bar = measured PRODUCTION impact
//    (`impactRedir` = velocity redirection), white cap = authored target.
//    Bars light up as the playhead crosses each beat. The detailed multi-candidate
//    comparison lives in the separate `ImpactStudyOverlay` composition. ──────────
const IMPACT_RAMP = ["#38d6c8", "#f0b429", "#ff5a4f"]; // soft → medium → hard
const IMPACT_LABEL_COLOR = "#ff6b5c"; // distinct from air (teal) / speed (amber)
// Full-height impact lane: a peer of the AIR/SPEED charts (label + live readout
// up top, target caps + colored bars rising from the baseline).
const ImpactRow: React.FC<{
  contacts: Bundle["contacts"]; w: number; h: number; t: number; tx: (t: number) => number;
  sizing?: Partial<ChartSizing>;
}> = ({ contacts, w, h, t, tx, sizing }) => {
  const S = { ...DEFAULT_SIZING, ...sizing };
  const barMax = h - S.impactHead; // headroom for the label/readout and the glow caps
  const half = S.impactBarW / 2;
  // current readout = most recent landed beat at/just before the playhead
  const landed = contacts.filter((c) => c.t <= t && (c.impactRedir ?? c.impact) != null);
  const cur = landed.length ? landed[landed.length - 1] : null;
  const curV = cur ? cur.impactRedir ?? cur.impact : null;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <line x1={S.padL} y1={h - 0.5} x2={w - S.padR} y2={h - 0.5} stroke="rgba(255,255,255,0.10)" />
      {contacts.map((c, i) => {
        const v = c.impactRedir ?? c.impact; // production metric (redir); fall back for old JSON
        const target = c.impactTarget;
        if (v == null && target == null) return null;
        const x = tx(c.t);
        const passed = c.t <= t;
        const bh = v == null ? 0 : 3 + Math.min(1, v) * barMax;
        const th = target == null ? null : 3 + Math.min(1, target) * barMax;
        const col = v == null ? "#8b93a7" : interpolateColors(Math.min(1, v), [0, 0.5, 1], IMPACT_RAMP);
        const glow = passed ? interpolate(t - c.t, [0, 0.16], [1, 0], { extrapolateRight: "clamp" }) : 0;
        return (
          <g key={i}>
            {th != null && (
              <line
                x1={x - S.impactTickHalf} y1={h - 1 - th} x2={x + S.impactTickHalf} y2={h - 1 - th}
                stroke="#f4f7ff" strokeWidth={1.6} opacity={passed ? 0.72 : 0.26}
              />
            )}
            {v != null && <rect x={x - half} y={h - 1 - bh} width={S.impactBarW} height={bh} rx={2} fill={col} opacity={passed ? 0.95 : 0.16} />}
            {v != null && glow > 0 && <circle cx={x} cy={h - 1 - bh} r={S.impactTickHalf} fill={col} opacity={glow * 0.9} />}
          </g>
        );
      })}

      {/* label + live readout (measured / target), mirroring AxisChart */}
      <text x={S.labelX} y={S.labelY} fontFamily={FONT} fontSize={S.labelSize} fontWeight={700} fill={IMPACT_LABEL_COLOR} letterSpacing={1}>
        IMPACT
      </text>
      {cur && curV != null && (
        <text x={S.labelX} y={S.readoutY} fontFamily={FONT} fontSize={S.readoutSize} fill="#fff">
          {curV.toFixed(2)}
          {cur.impactTarget != null && (
            <tspan fill={IMPACT_LABEL_COLOR} fontSize={S.readoutSubSize}> / {cur.impactTarget.toFixed(2)}</tspan>
          )}
        </text>
      )}
    </svg>
  );
};

// ── BIG impact panel (top-center): two stacked lanes for the metric REVIEW —
//    REDIR (the locked "how MUCH redirected" magnitude) over SNAP (the candidate
//    "how SUDDENLY / force" suddenness). Same time axis + same colour ramp so the
//    divergence beats — tall REDIR + short SNAP = big-but-smooth; the reverse =
//    small-but-snappy — pop out for felt labelling. White ticks = authored target
//    (REDIR lane only). See docs/impact_problem_statement.md. ───────────────────
const impactMetric = (c: Bundle["contacts"][number], key: string): number | null => {
  const value = c[key as keyof typeof c];
  return typeof value === "number" ? value : null;
};
const heroColor = (v: number) => interpolateColors(Math.min(1, v), [0, 0.5, 1], ["#38d6c8", "#f0b429", "#ff4d4d"]);
const IMPACT_LANES = [
  { key: "impactRedir", name: "REDIR", sub: "how MUCH redirected · locked metric", target: true },
  { key: "impactSnap", name: "SNAP", sub: "how SUDDENLY · force candidate", target: false },
] as const;
const BigImpactPanel: React.FC<{ contacts: Bundle["contacts"]; width: number; t: number; durationS: number; enter: number }>
= ({ contacts, width, t, durationS, enter }) => {
  const w = Math.round(width * 0.92);          // more space, per the design
  const left = Math.round((width - w) / 2);
  const top = 40;
  const padL = 150, padR = 64, headerH = 40, laneH = 120, laneGap = 26;
  const h = headerH + IMPACT_LANES.length * laneH + (IMPACT_LANES.length - 1) * laneGap + 14;
  const x0 = padL, x1 = w - padR;
  const tx = (tt: number) => x0 + (Math.min(tt, durationS) / durationS) * (x1 - x0);
  const beats = contacts.filter((c) =>
    IMPACT_LANES.some((l) => impactMetric(c, l.key) != null) || c.impactTarget != null
  );
  // The landing the playhead is on/just past — for the big live readout.
  const current = [...beats].filter((c) => c.t <= t + 1e-6).sort((a, b) => b.t - a.t)[0];
  const spacingPx = beats.length > 1 ? (x1 - x0) / beats.length : 30;
  const showNums = spacingPx >= 9; // print per-landing value when there's room

  const laneBase = (j: number) => headerH + (j + 1) * laneH + j * laneGap;
  return (
    <div style={{
      position: "absolute", left, top, width: w, opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [-40, 0])}px)`,
      background: "rgba(9,11,16,0.93)", border: BORDER, borderRadius: 14,
    }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        <text x={padL} y={26} fontFamily={FONT} fontSize={17} fontWeight={700} fill="#e6eaf2" letterSpacing={2}>LANDING IMPACT — METRIC REVIEW</text>
        <text x={padL + 330} y={26} fontFamily={FONT} fontSize={12} fill="#7c8499">REDIR vs SNAP · white ticks = target</text>
        {/* live readout: both candidates for the current landing */}
        {current && (
          <text x={x1} y={28} textAnchor="end" fontFamily={FONT} fontSize={20} fontWeight={700}>
            {IMPACT_LANES.map((l, j) => {
              const v = impactMetric(current, l.key);
              return v == null ? null : (
                <tspan key={l.key} fill={heroColor(v)}>{j > 0 ? "  " : ""}{l.name[0]}:{v.toFixed(2)}</tspan>
              );
            })}
          </text>
        )}

        {IMPACT_LANES.map((lane, j) => {
          const base = laneBase(j);
          return (
            <g key={lane.key}>
              <text x={16} y={base - laneH / 2 - 4} fontFamily={FONT} fontSize={15} fontWeight={700} fill="#cdd4e0" letterSpacing={1}>{lane.name}</text>
              <text x={16} y={base - laneH / 2 + 12} fontFamily={FONT} fontSize={9} fill="#7c8499">{lane.sub}</text>
              {[0.25, 0.5, 0.75, 1].map((g) => (
                <line key={g} x1={padL} y1={base - g * (laneH - 14)} x2={x1} y2={base - g * (laneH - 14)} stroke="rgba(255,255,255,0.05)" />
              ))}
              <line x1={padL} y1={base} x2={x1} y2={base} stroke="rgba(255,255,255,0.15)" />
              {beats.map((c, i) => {
                const v = impactMetric(c, lane.key);
                if (v == null) return null;
                const x = tx(c.t), passed = c.t <= t, bh = 2 + Math.min(1, v) * (laneH - 14);
                const target = lane.target ? c.impactTarget : null;
                const th = target == null ? null : 2 + target * (laneH - 14);
                const col = heroColor(v);
                const glow = passed ? interpolate(t - c.t, [0, 0.2], [1, 0], { extrapolateRight: "clamp" }) : 0;
                return (
                  <g key={i} opacity={passed ? 1 : 0.22}>
                    {th != null && (
                      <line x1={x - 7} y1={base - th} x2={x + 7} y2={base - th} stroke="#f4f7ff" strokeWidth={1.8} opacity={passed ? 0.82 : 0.5} />
                    )}
                    <rect x={x - 2.5} y={base - bh} width={5} height={bh} rx={2} fill={col} />
                    {glow > 0.02 && <circle cx={x} cy={base - bh} r={7} fill={col} opacity={glow} />}
                    {showNums && (
                      <text x={x} y={base - bh - 5} textAnchor="start" transform={`rotate(-90 ${x} ${base - bh - 5})`}
                        fontFamily={FONT} fontSize={9} fill={passed ? "#aeb6c7" : "#586074"}>{v.toFixed(2)}</text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        <line x1={tx(t)} y1={headerH} x2={tx(t)} y2={laneBase(IMPACT_LANES.length - 1) + 2} stroke="#fff" strokeWidth={1.4} opacity={0.85} />
      </svg>
    </div>
  );
};

// Shared overlay-input props + data fetch (both compositions read the same bundle
// from the pipeline). `label` is the delayRender tag (distinct per composition).
const overlayInputs = () => {
  const props = getInputProps() as { dataFile?: string; videoFile?: string };
  return { dataFile: props.dataFile ?? "believer_curves.overlay.json", videoFile: props.videoFile ?? "source.mp4" };
};
function useBundle(dataFile: string, label: string): Bundle | null {
  const [data, setData] = useState<Bundle | null>(null);
  const [handle] = useState(() => delayRender(label));
  useEffect(() => {
    fetch(staticFile(dataFile))
      .then((r) => r.json())
      .then((j: Bundle) => { setData(j); continueRender(handle); })
      .catch(() => continueRender(handle));
  }, [handle, dataFile]);
  return data;
}
// Top-left title pill (song title + artist + a right-hand label).
const TitlePill: React.FC<{ title: string; artist: string; right: string }> = ({ title, artist, right }) => (
  <div style={{
    position: "absolute", top: 40, left: 40, display: "flex", alignItems: "center", gap: 14,
    background: PILL, border: BORDER, borderRadius: 12, padding: "10px 20px", fontFamily: FONT,
  }}>
    <span style={{ fontSize: 23, fontWeight: 700, color: "#fff", letterSpacing: 2 }}>{title}</span>
    <span style={{ fontSize: 17, color: "#8b93a7", letterSpacing: 1 }}>{artist}</span>
    <span style={{ width: 1, height: 20, background: "rgba(255,255,255,0.18)" }} />
    <span style={{ fontSize: 17, color: "#aeb6c7", letterSpacing: 1 }}>{right}</span>
  </div>
);

// Top-left active-phase chip — the phase NAME lives here, clean and readable,
// instead of being crammed into the bottom band (which is now a slim strip).
const PhaseChip: React.FC<{ phase: Phase | null }> = ({ phase }) =>
  phase ? (
    <div style={{
      position: "absolute", top: 88, left: 40, display: "flex", alignItems: "center", gap: 10,
      background: PILL, border: BORDER, borderRadius: 10, padding: "7px 16px", fontFamily: FONT,
    }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: phase.color }} />
      <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 2, textTransform: "uppercase" }}>
        {phase.name}
      </span>
    </div>
  ) : null;

const BottomCurvePanel: React.FC<{
  data: Bundle;
  width: number;
  t: number;
  enter: number;
  showImpactRow: boolean;
}> = ({ data, width, t, enter, showImpactRow }) => {
  const dur = data.durationS;
  const M = 40; // single shared margin (title, panel sides, bottom gap)
  // Compact panel: ~2.7× narrower than full width, anchored in the bottom-left.
  const panelW = Math.round((width - 2 * M) / 2.7);

  // Amplitude/elevation (launch-angle axes) are intentionally not plotted here —
  // the panel shows AIR, SPEED and IMPACT, each an equal third.
  const axes = data.axes.filter((a) => a.axis !== "amplitude" && a.axis !== "elevation");

  const phaseH = 12; // slim phase timeline strip (names now live top-left)
  const panelPadV = 12;
  // Keep the panel basically the same height as the old 3-axis layout, but split
  // the content into equal rows (each plotted axis + the impact lane) so AIR /
  // SPEED / IMPACT each occupy a full third.
  const TARGET_CONTENT_H = 346;
  const rowCount = Math.max(1, axes.length + (showImpactRow ? 1 : 0));
  const rowH = Math.round((TARGET_CONTENT_H - phaseH - 10) / rowCount);
  const chartH = rowH;
  const impactH = showImpactRow ? rowH : 0;
  const contentH = chartH * axes.length + impactH + phaseH + 10;
  const panelH = contentH + panelPadV * 2;
  const panelTop = 1080 - panelH - M;
  const panelLeft = M;
  const panelY = interpolate(enter, [0, 1], [60, 0]);

  const plotX0 = panelLeft + CHART_PAD_L; // matches AxisChart padL within the panel
  const plotX1 = panelLeft + panelW - CHART_PAD_R;
  const tx = (tt: number) => plotX0 + (Math.min(tt, dur) / dur) * (plotX1 - plotX0);
  const activePhase = data.phases.find((p) => t >= p.t0 && t < p.t1) ?? data.phases[data.phases.length - 1];

  return (
    <>
      <div style={{
        position: "absolute", left: panelLeft, top: panelTop, width: panelW,
        transform: `translateY(${panelY}px)`, opacity: enter,
        background: "rgba(9,11,16,0.90)", border: BORDER, borderRadius: 14, padding: `${panelPadV}px 0`,
      }}>
        {/* legend */}
        <div style={{
          position: "absolute", top: 8, right: 12, fontFamily: FONT, fontSize: 14, color: "#8b93a7",
          display: "flex", gap: 12, alignItems: "center",
        }}>
          <span>target <span style={{ color: "#fff" }}>━</span></span>
          <span>measured <span style={{ color: "#fff" }}>●</span></span>
          {showImpactRow && (
            <span>impact <span style={{ color: "#f4f7ff" }}>━</span>/<span style={{ color: "#38d6c8" }}>▁</span><span style={{ color: "#f0b429" }}>▄</span><span style={{ color: "#ff5a4f" }}>█</span></span>
          )}
        </div>

        {axes.map((a) => (
          <AxisChart key={a.axis} data={a} w={panelW} h={chartH} durationS={dur} t={t} />
        ))}

        {showImpactRow && <ImpactRow contacts={data.contacts} w={panelW} h={impactH} t={t} tx={(tt) => tx(tt) - M} />}

        {/* phase timeline strip — colored bands only; the active phase NAME is
            shown cleanly in the top-left PhaseChip, not crammed in here. */}
        <svg width={panelW} height={phaseH} style={{ display: "block" }}>
          {data.phases.map((p) => {
            const x0 = tx(p.t0) - M;
            const x1 = tx(p.t1) - M;
            const active = p === activePhase;
            return (
              <rect key={p.name} x={x0 + 1} y={2} width={Math.max(0, x1 - x0 - 2)} height={phaseH - 4} rx={3}
                fill={p.color} opacity={active ? 0.95 : 0.28} />
            );
          })}
        </svg>
      </div>

      {/* full-height playhead across the whole panel */}
      <div style={{
        position: "absolute", left: tx(t), top: panelTop + panelPadV,
        width: 2, height: contentH, transform: `translateY(${panelY}px)`,
        background: "rgba(255,255,255,0.9)", boxShadow: "0 0 6px rgba(255,255,255,0.8)", opacity: enter,
      }} />
    </>
  );
};

// ── VERTICAL (9:16 / YouTube Shorts) ─────────────────────────────────────────
// The ride is rendered full-frame at 1080x1920 (a true vertical render, zoomed in
// ~1.8x so the rider stays the hero — see scripts/export.ts --zoom-mult). The rider
// rides ~vertical-center, leaving blank sky up top (song title) and blank ground
// below (the AIR/SPEED/IMPACT panel). Both bands use dark pills because the ride
// background is WHITE. Overlay content stays out of YouTube's safe areas: the
// right ~12% (action buttons) and bottom ~15% (title/handle/CTA).

// Bigger sizing for the vertical panel — the panel is the hero element on a Short,
// so labels/readouts/curves/bars are scaled up well beyond the landscape defaults.
const VERTICAL_SIZING: Partial<ChartSizing> = {
  padL: 206, padR: 22,
  labelX: 18, labelY: 42, labelSize: 32,
  readoutY: 86, readoutSize: 34, readoutSubSize: 24,
  dotR: 3.6, liveDotR: 8, strokeW: 3.6,
  impactBarW: 7, impactTickHalf: 9, impactHead: 56,
};

// Variant knobs for the vertical overlay — every layout choice is a prop so we can
// render many side-by-side variants (margins, rider height, panel size, bottom
// treatment) without editing code. Pass via Remotion --props.
type PanelMode = "clean" | "mirror";
type VertVariant = {
  riderShiftPct: number;   // how far up to push the ride (fraction of frame height)
  sideMarginPct: number;   // L/R margin so nothing touches edges (phones crop ~2-3%)
  bottomSafePct: number;   // gap kept under the data panel for YouTube's bottom UI
  rowH: number;            // height of each AIR/SPEED/IMPACT row
  showPanel: boolean;      // the AIR/SPEED/IMPACT data panel (developer instrument)
  panelMode: PanelMode;    // clean | mirror (blurred reflection) — only when showPanel
  showSpectrum: boolean;   // the music spectrum visualizer
  specSym: boolean;        // symmetric (up+down) vs up-only (rising from a baseline)
  specCenterPct: number;   // baseline (up-only) / center (sym) of the spectrum, frac of height
  specMaxBarPct: number;   // max bar height, frac of height
  specFullWidth: boolean;  // edge-to-edge (no L/R margin, no edge fade) vs inset+faded
};
// Default is now spectrum-forward: no data panel, rider nudged up, big symmetric
// edge-to-edge spectrum with balanced gap above (to rider) and below (to frame edge).
const DEFAULT_VARIANT: VertVariant = {
  riderShiftPct: 0.15, sideMarginPct: 0.03, bottomSafePct: 0.14, rowH: 190,
  showPanel: false, panelMode: "clean",
  showSpectrum: true, specSym: true, specCenterPct: 0.73, specMaxBarPct: 0.17, specFullWidth: true,
};

// ── music spectrum (from scripts/make_spectrum.py) ────────────────────────────
type Spectrum = { fps: number; bands: number; frames: number[][] };
function useSpectrum(file: string | null, label: string): Spectrum | null {
  const [data, setData] = useState<Spectrum | null>(null);
  const [handle] = useState(() => delayRender(label));
  useEffect(() => {
    if (!file) { continueRender(handle); return; }
    fetch(staticFile(file)).then((r) => r.json()).then((j: Spectrum) => { setData(j); continueRender(handle); }).catch(() => continueRender(handle));
  }, [handle, file]);
  return data;
}
const SPECTRUM_RAMP = ["#38d6c8", "#6ad36a", "#f0b429", "#ff5a4f"];
// Full-width frequency-bar visualizer, faded into white at the L/R edges so it never
// touches the cropped phone edges. `baseY` is the baseline (bars rise upward from it);
// `sym` also mirrors them downward. The svg is sized to hold both halves either way.
const SpectrumViz: React.FC<{
  spec: Spectrum; t: number; left: number; width: number; baseY: number; maxBar: number;
  sym: boolean; fade: boolean; enter: number; id: string;
}> = ({ spec, t, left, width, baseY, maxBar, sym, fade, enter, id }) => {
  const fi = Math.max(0, Math.min(spec.frames.length - 1, Math.floor(t * spec.fps)));
  const row = spec.frames[fi] ?? [];
  const n = row.length || 1;
  const gap = 3;
  const bw = (width - gap * (n - 1)) / n;
  const svgH = sym ? maxBar * 2 : maxBar;   // local baseline is always at y = maxBar
  return (
    <svg width={width} height={svgH} style={{ position: "absolute", left, top: baseY - maxBar, opacity: enter }}>
      <defs>
        <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="0.07" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.93" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
      </defs>
      {row.map((v, b) => {
        const x = b * (bw + gap);
        const h = Math.max(2, v * maxBar);
        const col = interpolateColors(b / Math.max(1, n - 1), [0, 0.4, 0.7, 1], SPECTRUM_RAMP);
        return (
          <g key={b}>
            <rect x={x} y={maxBar - h} width={bw} height={h} rx={bw / 3} fill={col} opacity={0.95} />
            {sym && <rect x={x} y={maxBar} width={bw} height={h} rx={bw / 3} fill={col} opacity={0.42} />}
          </g>
        );
      })}
      {fade && <rect x={0} y={0} width={width} height={svgH} fill={`url(#${id})`} />}
    </svg>
  );
};

// The dark card itself (AIR/SPEED/IMPACT rows + phase strip). tx is panel-LOCAL so
// the card can be reused verbatim for the reflection. `position: relative` anchors
// the legend inside it.
const VerticalPanelCard: React.FC<{
  data: Bundle; panelW: number; t: number; S: ChartSizing;
  rowH: number; phaseH: number; panelPadV: number; activePhase?: Phase;
}> = ({ data, panelW, t, S, rowH, phaseH, panelPadV, activePhase }) => {
  const dur = data.durationS;
  const axes = data.axes.filter((a) => a.axis !== "amplitude" && a.axis !== "elevation");
  const plotX0 = S.padL, plotX1 = panelW - S.padR;
  const txL = (tt: number) => plotX0 + (Math.min(tt, dur) / dur) * (plotX1 - plotX0);
  return (
    <div style={{
      position: "relative", width: panelW,
      background: "rgba(9,11,16,0.90)", border: BORDER, borderRadius: 20, padding: `${panelPadV}px 0`,
    }}>
      <div style={{
        position: "absolute", top: 14, right: 22, fontFamily: FONT, fontSize: 18, color: "#8b93a7",
        display: "flex", gap: 16, alignItems: "center",
      }}>
        <span>target <span style={{ color: "#fff" }}>━</span></span>
        <span>measured <span style={{ color: "#fff" }}>●</span></span>
      </div>
      {axes.map((a) => (
        <AxisChart key={a.axis} data={a} w={panelW} h={rowH} durationS={dur} t={t} sizing={S} />
      ))}
      <ImpactRow contacts={data.contacts} w={panelW} h={rowH} t={t} tx={txL} sizing={S} />
      <svg width={panelW} height={phaseH} style={{ display: "block" }}>
        {data.phases.map((p) => {
          const x0 = txL(p.t0), x1 = txL(p.t1);
          const active = p === activePhase;
          return (
            <rect key={p.name} x={x0 + 1} y={3} width={Math.max(0, x1 - x0 - 2)} height={phaseH - 6} rx={4}
              fill={p.color} opacity={active ? 0.95 : 0.28} />
          );
        })}
      </svg>
    </div>
  );
};

// The AIR/SPEED/IMPACT data panel positioned in the lower band, with the playhead and
// (optionally) a blurred reflection filling the bottom YouTube-UI zone. Developer view.
const VerticalDataPanel: React.FC<{
  data: Bundle; width: number; height: number; t: number; enter: number; variant: VertVariant;
}> = ({ data, width, height, t, enter, variant }) => {
  const dur = data.durationS;
  const panelLeft = Math.round(width * variant.sideMarginPct);
  const panelW = width - 2 * panelLeft;
  const bottomSafe = Math.round(height * variant.bottomSafePct);
  const S = { ...DEFAULT_SIZING, ...VERTICAL_SIZING };

  const axes = data.axes.filter((a) => a.axis !== "amplitude" && a.axis !== "elevation");
  const phaseH = 22, panelPadV = 18;
  const rowH = variant.rowH;
  const contentH = rowH * (axes.length + 1) + phaseH + 12;
  const panelH = contentH + panelPadV * 2;
  const panelTop = height - bottomSafe - panelH;
  const panelY = interpolate(enter, [0, 1], [60, 0]);

  const txGlobal = (tt: number) => panelLeft + S.padL + (Math.min(tt, dur) / dur) * (panelW - S.padL - S.padR);
  const activePhase = data.phases.find((p) => t >= p.t0 && t < p.t1) ?? data.phases[data.phases.length - 1];
  const card = (
    <VerticalPanelCard data={data} panelW={panelW} t={t} S={S} rowH={rowH} phaseH={phaseH} panelPadV={panelPadV} activePhase={activePhase} />
  );

  return (
    <>
      {variant.panelMode === "mirror" && (
        <>
          <div style={{
            position: "absolute", left: panelLeft, top: panelTop + panelH, width: panelW,
            transform: `translateY(${panelY}px) scaleY(-1)`, filter: "blur(7px)", opacity: enter * 0.5,
          }}>
            {card}
          </div>
          <div style={{
            position: "absolute", left: panelLeft, top: panelTop + panelH, width: panelW, height: panelH,
            transform: `translateY(${panelY}px)`,
            background: "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,1) 72%)",
          }} />
        </>
      )}

      <div style={{
        position: "absolute", left: panelLeft, top: panelTop, width: panelW,
        transform: `translateY(${panelY}px)`, opacity: enter,
      }}>
        {card}
      </div>

      <div style={{
        position: "absolute", left: txGlobal(t), top: panelTop + panelPadV,
        width: 3, height: contentH, transform: `translateY(${panelY}px)`,
        background: "rgba(255,255,255,0.9)", boxShadow: "0 0 6px rgba(255,255,255,0.8)", opacity: enter,
      }} />
    </>
  );
};

// Composes the lower-third: the music spectrum (hero) and/or the data panel, each
// independently toggleable so we can explore spectrum-only / panel-only / both.
const BottomCurvePanelVertical: React.FC<{
  data: Bundle; width: number; height: number; t: number; enter: number; variant: VertVariant; spectrum?: Spectrum | null;
}> = ({ data, width, height, t, enter, variant, spectrum }) => {
  const panelLeft = Math.round(width * variant.sideMarginPct);
  const panelW = width - 2 * panelLeft;
  return (
    <>
      {variant.showPanel && (
        <VerticalDataPanel data={data} width={width} height={height} t={t} enter={enter} variant={variant} />
      )}
      {variant.showSpectrum && spectrum && (
        <SpectrumViz
          spec={spectrum} t={t} id="specfade-main"
          left={variant.specFullWidth ? 0 : panelLeft}
          width={variant.specFullWidth ? width : panelW}
          baseY={Math.round(height * variant.specCenterPct)}
          maxBar={Math.round(height * variant.specMaxBarPct)}
          sym={variant.specSym} fade={!variant.specFullWidth} enter={enter}
        />
      )}
    </>
  );
};

export const CurveOverlayVertical: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;

  const { dataFile, videoFile } = overlayInputs();
  const props = getInputProps() as Partial<VertVariant> & { spectrumFile?: string };
  const variant: VertVariant = { ...DEFAULT_VARIANT, ...props };
  const data = useBundle(dataFile, "overlay-data-vertical");
  const spectrum = useSpectrum(props.spectrumFile ?? null, "spectrum-vertical");
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#fff" }} />;

  const enter = spring({ frame, fps, config: { damping: 20, mass: 0.7 } });
  const shift = Math.round(height * variant.riderShiftPct);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff" }}>
      {/* ride shifted up; revealed area below is white (matches the ride background) */}
      <AbsoluteFill style={{ transform: `translateY(${-shift}px)` }}>
        <OffthreadVideo src={staticFile(videoFile)} />
      </AbsoluteFill>
      <BottomCurvePanelVertical data={data} width={width} height={height} t={t} enter={enter} variant={variant} spectrum={spectrum} />
    </AbsoluteFill>
  );
};

export const CurveOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  const { dataFile, videoFile } = overlayInputs();
  const data = useBundle(dataFile, "overlay-data");

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const enter = spring({ frame, fps, config: { damping: 20, mass: 0.7 } });
  const activePhase = data.phases.find((p) => t >= p.t0 && t < p.t1) ?? data.phases[data.phases.length - 1] ?? null;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(videoFile)} />

      <TitlePill title={data.title} artist={data.artist} right={data.tempo} />
      <PhaseChip phase={activePhase} />
      <BottomCurvePanel data={data} width={width} t={t} enter={enter} showImpactRow={true} />
    </AbsoluteFill>
  );
};

// ── ImpactStudyOverlay: big impact target-vs-measured panel plus the ordinary
//    bottom-left axis context, without the compact impact row. ──────────────────
export const ImpactStudyOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const { dataFile, videoFile } = overlayInputs();
  const data = useBundle(dataFile, "impact-study-data");
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  const enter = spring({ frame, fps, config: { damping: 20, mass: 0.7 } });
  const activePhase = data.phases.find((p) => t >= p.t0 && t < p.t1) ?? data.phases[data.phases.length - 1] ?? null;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(videoFile)} />
      <PhaseChip phase={activePhase} />
      <BigImpactPanel contacts={data.contacts} width={width} t={t} durationS={data.durationS} enter={enter} />
      <BottomCurvePanel data={data} width={width} t={t} enter={enter} showImpactRow={false} />
    </AbsoluteFill>
  );
};
