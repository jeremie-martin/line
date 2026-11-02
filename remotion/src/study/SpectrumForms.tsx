import React from 'react';
import {ribbonPaths} from './spectrum';

export type SpectrumForm = 'contours' | 'memory' | 'stems' | 'blocks' | 'dots' | 'fan' | 'rails' | 'pleats' | 'caps';
export type SpectrumFormsProps = {
  mode: SpectrumForm;
  row: readonly number[];
  /** Actual earlier spectra, newest first. These are not delayed copies of the ride. */
  history: readonly (readonly number[])[];
  width: number;
  height: number;
  palette: readonly string[];
  accent: number;
  dark: boolean;
};

const unit = (value: number): number => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const audible = (row: readonly number[]): boolean => row.some(value => value > 0);

/** Transparent spectrum graphics in SVG coordinates; baseline is `height` px. */
export const SpectrumForms: React.FC<SpectrumFormsProps> = ({mode, row, history, width, height, palette, accent, dark}) => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !row.length) return null;
  const values = row.map(unit), hit = unit(accent);
  const colors = palette.length ? palette : [dark ? '#bceff2' : '#277d84'];
  const color = (fraction: number): string => colors[Math.min(colors.length - 1, Math.floor(unit(fraction) * colors.length))];
  const stroke = Math.max(.6, Math.min(2.2, width / 400));

  if (mode === 'contours') {
    if (!audible(values)) return null;
    return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {[.34, .56, .77, 1].map((scale, i) => <path key={scale}
        d={ribbonPaths(values.map(value => value * scale), width, height).crest}
        stroke={color(i / 3)} strokeWidth={stroke * (i === 3 ? 1.5 : .8)}
        opacity={i === 3 ? .88 : .28 + i * .08} />)}
    </g>;
  }
  if (mode === 'memory') {
    // Render oldest first so the current contour remains the clear foreground.
    const previous = history.slice(0, 3).map(samples => samples.map(unit));
    return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      {previous.map((samples, index) => ({samples, index})).reverse().map(({samples, index}) =>
        audible(samples) && <path key={index} d={ribbonPaths(samples, width, height).crest}
          stroke={color(index / 2)} strokeWidth={stroke * .8} opacity={.32 - index * .08} />)}
      {audible(values) && <path d={ribbonPaths(values, width, height).crest} stroke={color(1)}
        strokeWidth={stroke * 1.25} opacity={.92} />}
    </g>;
  }
  if (mode === 'stems') {
    const step = width / values.length;
    const radius = Math.min(step * .28, height / 4, stroke * (1.1 + .85 * hit));
    return <g>{values.map((value, i) => {
      if (value <= 0) return null;
      const x = (i + .5) * step, y = radius + (height - 2 * radius) * (1 - value);
      return <g key={i} stroke={color(i / Math.max(1, values.length - 1))}>
        <line x1={x} x2={x} y1={height} y2={y} strokeWidth={stroke * .9} opacity={.55} />
        <circle cx={x} cy={y} r={radius} fill={color(i / Math.max(1, values.length - 1))}
          stroke="none" opacity={.68 + .22 * hit} />
      </g>;
    })}</g>;
  }
  if (mode === 'dots') {
    const step = width / values.length, levels = 12, pitch = height / levels;
    const radius = Math.min(step * .23, pitch * .25);
    return <g>{values.map((value, i) => {
      const occupied = value * levels, count = Math.ceil(occupied);
      return Array.from({length: count}, (_, level) => <circle key={`${i}-${level}`}
        cx={(i + .5) * step} cy={height - (level + .5) * pitch} r={radius}
        fill={color(i / Math.max(1, values.length - 1))}
        // Fade in the fractional cell and move the bright crest continuously:
        // the previous cap settles to body ink as the next cap becomes visible.
        opacity={unit(occupied - level) * ((dark ? .3 : .5) + ((dark ? .42 : .3) + (dark ? .18 : .15) * hit) * unit(2 - occupied + level))} />);
    })}</g>;
  }
  if (mode === 'fan') {
    const radiusX = width * .46, radiusY = height * .9, inner = .14;
    return <g fill="none" strokeLinecap="round">{values.map((value, i) => {
      if (value <= 0) return null;
      const angle = Math.PI * (1 - (i + .5) / values.length), outer = inner + (1 - inner) * value;
      return <line key={i}
        x1={width / 2 + Math.cos(angle) * radiusX * inner} y1={height - Math.sin(angle) * radiusY * inner}
        x2={width / 2 + Math.cos(angle) * radiusX * outer} y2={height - Math.sin(angle) * radiusY * outer}
        stroke={color(i / Math.max(1, values.length - 1))} strokeWidth={stroke * (1 + .3 * hit)} opacity={.65} />;
    })}</g>;
  }
  if (mode === 'rails') {
    const inset = width * .02, extent = width * .09;
    const lineWidth = Math.min(2.5, height / values.length * .5, width * .01);
    return <g fill="none" strokeLinecap="round">{values.map((value, i) => {
      if (value <= 0) return null;
      const y = (i + .5) * height / values.length;
      return <g key={i} stroke={color(i / Math.max(1, values.length - 1))} strokeWidth={lineWidth} opacity={.65}>
        <line x1={inset} x2={inset + extent * value} y1={y} y2={y} />
        <line x1={width - inset} x2={width - inset - extent * value} y1={y} y2={y} />
      </g>;
    })}</g>;
  }
  if (mode === 'pleats') {
    const step = width / values.length, half = step * .39;
    return <g>{values.map((value, i) => {
      if (value <= 0) return null;
      const center = (i + .5) * step, top = height * (1 - value);
      const fold = Math.min(height * value * .12, step * .3);
      const left = center - half, right = center + half;
      // Each ridge is the actual band height. The shallow folded shoulders
      // supply material shading without connecting bands into an opaque panel.
      return <g key={i} fill={color(i / Math.max(1, values.length - 1))}>
        <polygon points={`${left},${height} ${center},${height} ${center},${top} ${left},${top + fold}`}
          opacity={.42 + .1 * hit} />
        <polygon points={`${center},${height} ${right},${height} ${right},${top + fold} ${center},${top}`}
          opacity={.65 + .08 * hit} />
      </g>;
    })}</g>;
  }
  if (mode === 'caps') {
    const step = width / values.length, barWidth = step * .38;
    const capWidth = step * .7, capStroke = Math.min(stroke, height, step * .4);
    const baseline = height - capStroke / 2, usableHeight = height - capStroke;
    return <g>{values.map((value, i) => {
      // Only the supplied historical samples can hold a cap above the current
      // band. Missing bands and invalid samples contribute no invented energy.
      const peak = Math.max(value, ...history.map(samples => unit(samples[i] ?? 0)));
      if (peak <= 0) return null;
      const center = (i + .5) * step, h = value * usableHeight;
      const y = baseline - peak * usableHeight, ink = color(i / Math.max(1, values.length - 1));
      return <g key={i}>
        {value > 0 && <rect x={center - barWidth / 2} y={baseline - h} width={barWidth} height={h}
          fill={ink} opacity={.52 + .08 * hit} />}
        <line x1={center - capWidth / 2} x2={center + capWidth / 2} y1={y} y2={y}
          stroke={ink} strokeWidth={capStroke} opacity={.85 + .1 * hit} />
      </g>;
    })}</g>;
  }
  // Open gaps and a restrained fill preserve the ride beneath the print blocks.
  // Quantization is a graphic choice; it never changes the underlying band data.
  const step = width / values.length, blockWidth = step * .58;
  return <g>{values.map((value, i) => {
    const levels = 16, h = Math.floor(value * levels) / levels * height;
    if (!h) return null;
    return <rect key={i} x={(i + .5) * step - blockWidth / 2} y={height - h}
      width={blockWidth} height={h} rx={Math.min(1, blockWidth / 4)}
      fill={color(i / Math.max(1, values.length - 1))} opacity={.7 + .15 * hit} />;
  })}</g>;
};
