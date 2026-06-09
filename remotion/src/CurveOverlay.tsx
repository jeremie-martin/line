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
    impactWindow?: number | null; impactRedir?: number | null; impactJolt?: number | null;
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

// ── one axis chart: full target curve + revealing measured dots + error stems ─
const AxisChart: React.FC<{
  data: AxisData;
  w: number;
  h: number;
  durationS: number;
  t: number;
}> = ({ data, w, h, durationS, t }) => {
  const padL = CHART_PAD_L; // room for the label + numeric readout
  const padR = CHART_PAD_R;
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
      <line x1={padL} y1={y(0.5)} x2={w - padR} y2={y(0.5)} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 6" />

      {/* target area + line */}
      <path d={areaPath} fill={data.color} opacity={0.07} />
      <path d={targetPath} fill="none" stroke={data.color} strokeWidth={2.5} opacity={0.92} />

      {/* error stems target→measured for revealed gaps */}
      {revealed.map((m, i) => {
        const e = Math.abs(m.error);
        const op = interpolate(e, [0, 0.25], [0.08, 0.5], { extrapolateRight: "clamp" });
        const under = m.achieved < m.target;
        return (
          <line
            key={i}
            x1={x(m.t)} y1={y(m.target)} x2={x(m.t)} y2={y(m.achieved)}
            stroke={under ? "#ff6b6b" : "#5ad1ff"} strokeWidth={2} opacity={op}
          />
        );
      })}

      {/* measured connecting line + dots (revealed) */}
      <path d={measuredLine} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} />
      {revealed.map((m, i) => (
        <circle key={i} cx={x(m.t)} cy={y(m.achieved)} r={2.4} fill="#fff" opacity={0.9} />
      ))}

      {/* playhead + live dot */}
      <line x1={playX} y1={0} x2={playX} y2={h} stroke="rgba(255,255,255,0.85)" strokeWidth={1.5} />
      {cur && <circle cx={x(cur.t)} cy={y(cur.achieved)} r={5} fill="#fff" stroke={data.color} strokeWidth={2} />}

      {/* label + numeric readout (measured / target) */}
      <text x={12} y={24} fontFamily={FONT} fontSize={18} fontWeight={700} fill={data.color} letterSpacing={1}>
        {data.label}
      </text>
      {cur && (
        <text x={12} y={48} fontFamily={FONT} fontSize={19} fill="#fff">
          {cur.achieved.toFixed(2)}
          <tspan fill={data.color} fontSize={13}> / {cur.target.toFixed(2)}</tspan>
        </text>
      )}
    </svg>
  );
};

// ── beat-impact row (creative default): one bar per beat = the PRODUCTION impact
//    (`impactRedir` = velocity redirection), height + soft→hard colour = intensity.
//    Bars light up as the playhead crosses each beat. The detailed multi-candidate
//    comparison lives in the separate `ImpactStudyOverlay` composition. ──────────
const IMPACT_RAMP = ["#38d6c8", "#f0b429", "#ff5a4f"]; // soft → medium → hard
const ImpactRow: React.FC<{
  contacts: Bundle["contacts"]; w: number; h: number; t: number; tx: (t: number) => number;
}> = ({ contacts, w, h, t, tx }) => {
  const barMax = h - 16;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <text x={12} y={h / 2 + 4} fontFamily={FONT} fontSize={12} fill="#8b93a7" letterSpacing={1}>IMPACT</text>
      <line x1={CHART_PAD_L} y1={h - 0.5} x2={w - CHART_PAD_R} y2={h - 0.5} stroke="rgba(255,255,255,0.10)" />
      {contacts.map((c, i) => {
        const v = c.impactRedir ?? c.impact; // production metric (redir); fall back for old JSON
        if (v == null) return null;
        const x = tx(c.t);
        const passed = c.t <= t;
        const bh = 3 + v * barMax;
        const col = interpolateColors(v, [0, 0.5, 1], IMPACT_RAMP);
        const glow = passed ? interpolate(t - c.t, [0, 0.16], [1, 0], { extrapolateRight: "clamp" }) : 0;
        return (
          <g key={i}>
            <rect x={x - 1.5} y={h - 1 - bh} width={3} height={bh} rx={1.5} fill={col} opacity={passed ? 0.95 : 0.16} />
            {glow > 0 && <circle cx={x} cy={h - 1 - bh} r={5} fill={col} opacity={glow * 0.9} />}
          </g>
        );
      })}
    </svg>
  );
};

// ── BIG impact panel (top-center): the LOCKED metric `redir` (perpendicular CoM
//    velocity redirection over ~6f) is the hero IMPACT lane — tall bars, soft→hard
//    color, the absolute [0,1] value printed per landing, and a large live readout
//    of the beat the playhead is on. A faint POINT lane (the old one-frame metric)
//    sits below for reference. See docs/impact_problem_statement.md. ─────────────
const IMPACT_HERO = "impactRedir"; // the locked metric
const heroColor = (v: number) => interpolateColors(Math.min(1, v), [0, 0.5, 1], ["#38d6c8", "#f0b429", "#ff4d4d"]);
const BigImpactPanel: React.FC<{ contacts: Bundle["contacts"]; width: number; t: number; durationS: number; enter: number }>
= ({ contacts, width, t, durationS, enter }) => {
  const w = Math.round(width * 0.92);          // more space, per the design
  const left = Math.round((width - w) / 2);
  const top = 100;
  const padL = 150, padR = 64, headerH = 40, heroH = 150, refH = 34, gap = 10;
  const h = headerH + heroH + gap + refH + 14;
  const x0 = padL, x1 = w - padR;
  const tx = (tt: number) => x0 + (Math.min(tt, durationS) / durationS) * (x1 - x0);
  const beats = contacts.filter((c) => (c as Record<string, number | null>)[IMPACT_HERO] != null);
  // The landing the playhead is on/just past — for the big live readout.
  const current = [...beats].filter((c) => c.t <= t + 1e-6).sort((a, b) => b.t - a.t)[0];
  const curV = current ? ((current as Record<string, number | null>)[IMPACT_HERO] as number) : null;
  const spacingPx = beats.length > 1 ? (x1 - x0) / beats.length : 30;
  const showNums = spacingPx >= 9; // print per-landing value when there's room

  const heroBase = headerH + heroH;
  const refY0 = heroBase + gap, refBase = refY0 + refH;
  return (
    <div style={{
      position: "absolute", left, top, width: w, opacity: enter,
      transform: `translateY(${interpolate(enter, [0, 1], [-40, 0])}px)`,
      background: "rgba(9,11,16,0.93)", border: BORDER, borderRadius: 14,
    }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        <text x={padL} y={26} fontFamily={FONT} fontSize={17} fontWeight={700} fill="#e6eaf2" letterSpacing={2}>LANDING IMPACT</text>
        <text x={padL + 175} y={26} fontFamily={FONT} fontSize={12} fill="#7c8499">redirection · 0–1 absolute</text>
        {/* big live readout of the current landing's value */}
        {curV != null && (
          <text x={x1} y={28} textAnchor="end" fontFamily={FONT} fontSize={26} fontWeight={700} fill={heroColor(curV)}>{curV.toFixed(2)}</text>
        )}

        {/* hero lane: redir */}
        <text x={16} y={headerH + heroH / 2 - 4} fontFamily={FONT} fontSize={15} fontWeight={700} fill="#cdd4e0" letterSpacing={1}>IMPACT</text>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={padL} y1={heroBase - g * (heroH - 14)} x2={x1} y2={heroBase - g * (heroH - 14)} stroke="rgba(255,255,255,0.05)" />
        ))}
        <line x1={padL} y1={heroBase} x2={x1} y2={heroBase} stroke="rgba(255,255,255,0.15)" />
        {beats.map((c, i) => {
          const v = (c as Record<string, number | null>)[IMPACT_HERO] as number;
          const x = tx(c.t), passed = c.t <= t, bh = 2 + v * (heroH - 14);
          const col = heroColor(v);
          const glow = passed ? interpolate(t - c.t, [0, 0.2], [1, 0], { extrapolateRight: "clamp" }) : 0;
          return (
            <g key={i} opacity={passed ? 1 : 0.22}>
              <rect x={x - 2.5} y={heroBase - bh} width={5} height={bh} rx={2} fill={col} />
              {glow > 0.02 && <circle cx={x} cy={heroBase - bh} r={7} fill={col} opacity={glow} />}
              {showNums && (
                <text x={x} y={heroBase - bh - 5} textAnchor="start" transform={`rotate(-90 ${x} ${heroBase - bh - 5})`}
                  fontFamily={FONT} fontSize={9} fill={passed ? "#aeb6c7" : "#586074"}>{v.toFixed(2)}</text>
              )}
            </g>
          );
        })}

        {/* reference lane: point (old one-frame metric), faint */}
        <text x={16} y={refY0 + refH / 2 + 4} fontFamily={FONT} fontSize={11} fill="#6b7488">point (old)</text>
        <line x1={padL} y1={refBase} x2={x1} y2={refBase} stroke="rgba(255,255,255,0.08)" />
        {beats.map((c, i) => {
          const v = c.impact; if (v == null) return null;
          const x = tx(c.t), passed = c.t <= t, bh = 1 + v * (refH - 6);
          return <rect key={i} x={x - 1.5} y={refBase - bh} width={3} height={bh} rx={1} fill="#f0b429" opacity={passed ? 0.5 : 0.12} />;
        })}

        <line x1={tx(t)} y1={headerH} x2={tx(t)} y2={refBase + 2} stroke="#fff" strokeWidth={1.4} opacity={0.85} />
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
    background: PILL, border: BORDER, borderRadius: 12, padding: "11px 22px", fontFamily: FONT,
  }}>
    <span style={{ fontSize: 26, fontWeight: 700, color: "#fff", letterSpacing: 2 }}>{title}</span>
    <span style={{ fontSize: 20, color: "#8b93a7", letterSpacing: 1 }}>{artist}</span>
    <span style={{ width: 1, height: 22, background: "rgba(255,255,255,0.18)" }} />
    <span style={{ fontSize: 20, color: "#aeb6c7", letterSpacing: 1 }}>{right}</span>
  </div>
);

export const CurveOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  const { dataFile, videoFile } = overlayInputs();
  const data = useBundle(dataFile, "overlay-data");

  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;

  const dur = data.durationS;
  const M = 40; // single shared margin (title, panel sides, bottom gap)
  // Compact panel: ~2.5× narrower than full width, anchored in the bottom-left.
  const panelW = Math.round((width - 2 * M) / 2.5);
  const chartH = 116; // ~10% shorter than the first cut
  const phaseH = 44; // taller band so the section labels read clearly
  const impactH = 40; // beat-impact row
  const panelPadV = 12;
  const contentH = chartH * data.axes.length + impactH + phaseH + 10;
  const panelH = contentH + panelPadV * 2;
  const panelTop = 1080 - panelH - M;
  const panelLeft = M;

  const enter = spring({ frame, fps, config: { damping: 20, mass: 0.7 } });
  const panelY = interpolate(enter, [0, 1], [60, 0]);

  const plotX0 = panelLeft + CHART_PAD_L; // matches AxisChart padL within the panel
  const plotX1 = panelLeft + panelW - CHART_PAD_R;
  const tx = (tt: number) => plotX0 + (Math.min(tt, dur) / dur) * (plotX1 - plotX0);

  const activePhase = data.phases.find((p) => t >= p.t0 && t < p.t1) ?? data.phases[data.phases.length - 1];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(videoFile)} />

      <TitlePill title={data.title} artist={data.artist} right={data.tempo} />

      {/* bottom panel: stacked target-vs-measured charts + contacts + phases */}
      <div style={{
        position: "absolute", left: panelLeft, top: panelTop, width: panelW,
        transform: `translateY(${panelY}px)`, opacity: enter,
        background: "rgba(9,11,16,0.90)", border: BORDER, borderRadius: 14, padding: `${panelPadV}px 0`,
      }}>
        {/* legend */}
        <div style={{
          position: "absolute", top: 8, right: 12, fontFamily: FONT, fontSize: 11, color: "#8b93a7",
          display: "flex", gap: 10, alignItems: "center",
        }}>
          <span>target <span style={{ color: "#fff" }}>━</span></span>
          <span>measured <span style={{ color: "#fff" }}>●</span></span>
          <span>error <span style={{ color: "#ff6b6b" }}>┃</span><span style={{ color: "#5ad1ff" }}>┃</span></span>
          <span>impact <span style={{ color: "#38d6c8" }}>▁</span><span style={{ color: "#f0b429" }}>▄</span><span style={{ color: "#ff5a4f" }}>█</span> redirection</span>
        </div>

        {data.axes.map((a) => (
          <AxisChart key={a.axis} data={a} w={panelW} h={chartH} durationS={dur} t={t} />
        ))}

        {/* beat-impact row: measured landing intensity per beat */}
        <ImpactRow contacts={data.contacts} w={panelW} h={impactH} t={t} tx={(tt) => tx(tt) - M} />

        {/* phase band */}
        <svg width={panelW} height={phaseH} style={{ display: "block" }}>
          {data.phases.map((p) => {
            const x0 = tx(p.t0) - M;
            const x1 = tx(p.t1) - M;
            const active = p === activePhase;
            // Keep the label inside the panel even for narrow edge segments.
            const approxW = p.name.length * 20 * 0.6;
            const cx = Math.max(approxW / 2 + 6, Math.min(panelW - approxW / 2 - 6, (x0 + x1) / 2));
            return (
              <g key={p.name}>
                <rect x={x0 + 1} y={6} width={Math.max(0, x1 - x0 - 2)} height={phaseH - 12} rx={4}
                  fill={p.color} opacity={active ? 0.9 : 0.3} />
                <text x={cx} y={phaseH / 2 + 7} textAnchor="middle" fontFamily={FONT}
                  fontSize={20} fontWeight={active ? 700 : 600}
                  fill={active ? "#0a0c12" : "rgba(255,255,255,0.82)"} letterSpacing={1.5}>
                  {x1 - x0 > 50 ? p.name : ""}
                </text>
              </g>
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
    </AbsoluteFill>
  );
};

// ── ImpactStudyOverlay: the IMPACT STUDY mode (separate Remotion composition). The
//    big top-center panel comparing the impact-metric candidates per landing (redir
//    hero with the per-landing value + a faint point reference). Same input props as
//    CurveOverlay (dataFile, videoFile, durationS). Use this to inspect/validate the
//    landing-intensity metric; CurveOverlay stays the creative annotated overlay. ──
export const ImpactStudyOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const { dataFile, videoFile } = overlayInputs();
  const data = useBundle(dataFile, "impact-study-data");
  if (!data) return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
  const enter = spring({ frame, fps, config: { damping: 20, mass: 0.7 } });
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <OffthreadVideo src={staticFile(videoFile)} />
      <TitlePill title={data.title} artist={data.artist} right="impact study" />
      <BigImpactPanel contacts={data.contacts} width={width} t={t} durationS={data.durationS} enter={enter} />
    </AbsoluteFill>
  );
};
