import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {StudyFrame} from './looks';

/** Map darkness to coloured ink, preserving the original black centre and white paper. */
export const StudyRide: React.FC<{look: StudyFrame | null; children: React.ReactNode}> = ({look, children}) => {
  if (!look) return <>{children}</>;
  const ink = look.ink;
  const transform = look.x !== undefined || look.rotation !== undefined
    ? `translate(${look.x ?? 0}px, ${look.y}px) rotate(${look.rotation ?? 0}deg) scale(${look.scale})`
    : `translateY(${look.y}px) scale(${look.scale})`;
  if (look.surface) {
    const surface = look.surface;
    // Convert only existing ink to alpha. The opaque white movie background
    // disappears, so coloured paper and atmosphere can sit genuinely behind it.
    return <AbsoluteFill style={{transform, transformOrigin: '50% 35%'}}>
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden><defs>
        <filter id="study-surface" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="darkness" />
          <feComposite in="darkness" in2="SourceAlpha" operator="in" result="mask" />
          {surface.weight !== undefined && <>
          <feMorphology in="mask" operator="dilate" radius={1.2} result="weighted" />
          <feFlood floodColor={surface.core} floodOpacity={surface.weight ?? 0} result="weight-colour" />
          <feComposite in="weight-colour" in2="weighted" operator="in" result="weight-ink" />
          </>}
          <feFlood floodColor={surface.core} result="colour" />
          <feComposite in="colour" in2="mask" operator="in" result="core" />
          {surface.shadow && <>
            <feGaussianBlur in="mask" stdDeviation={surface.shadowBlur ?? 0} result="shadow-mask" />
            <feOffset in="shadow-mask" dx={surface.offset ?? 0} dy={(surface.offset ?? 0) * .65} result="offset" />
            <feFlood floodColor={surface.shadow} result="shadow-colour" />
            <feComposite in="shadow-colour" in2="offset" operator="in" result="shadow" />
          </>}
          {surface.highlight && <>
            <feOffset in="mask" dx={-(surface.offset ?? 0)} dy={-(surface.offset ?? 0) * .65} result="highlight-mask" />
            <feFlood floodColor={surface.highlight} result="highlight-colour" />
            <feComposite in="highlight-colour" in2="highlight-mask" operator="in" result="highlight" />
          </>}
          {surface.halo && <>
            <feGaussianBlur in="mask" stdDeviation={surface.haloRadius ?? 2} result="blur" />
            <feFlood floodColor={surface.halo} floodOpacity={.65} result="halo-colour" />
            <feComposite in="halo-colour" in2="blur" operator="in" result="halo" />
          </>}
          <feMerge>{surface.highlight && <feMergeNode in="highlight" />}{surface.shadow && <feMergeNode in="shadow" />}{surface.halo && <feMergeNode in="halo" />}{surface.weight !== undefined && <feMergeNode in="weight-ink" />}<feMergeNode in="core" /></feMerge>
        </filter>
      </defs></svg>
      <AbsoluteFill style={{filter: 'url(#study-surface)'}}>{children}</AbsoluteFill>
    </AbsoluteFill>;
  }
  return <AbsoluteFill style={{transform, transformOrigin: '50% 35%',
    filter: look.dark ? 'invert(1)' : ink > .01 ? 'url(#study-ink)' : undefined,
    mixBlendMode: look.dark ? 'screen' : undefined}}>
    {ink > .01 && <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden><defs>
      <filter id="study-ink" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="ink-luma" />
        <feComposite in="ink-luma" in2="SourceAlpha" operator="in" result="ink-mask" />
        <feOffset in="ink-mask" dx={ink} dy={ink * .3} result="cyan-mask" />
        <feFlood floodColor="#00b8cf" result="cyan" /><feComposite in="cyan" in2="cyan-mask" operator="in" result="cyan-ink" />
        <feOffset in="ink-mask" dx={-ink * .7} dy={-ink * .2} result="coral-mask" />
        <feFlood floodColor="#ff5875" result="coral" /><feComposite in="coral" in2="coral-mask" operator="in" result="coral-ink" />
        <feBlend in="SourceGraphic" in2="cyan-ink" mode="multiply" result="first" />
        <feBlend in="first" in2="coral-ink" mode="multiply" />
      </filter>
    </defs></svg>}
    {children}
  </AbsoluteFill>;
};

/** Decorative contact ripples live in the spectrum band, never on a fictitious track collision. */
export const StudyRipples: React.FC<{look: StudyFrame | null; width: number; height: number; center: number}> = ({look, width, height, center}) => {
  if (!look?.ripples.length) return null;
  return <svg width={width} height={height} style={{position:'absolute', inset: 0, pointerEvents:'none',
    mixBlendMode: look.dark ? 'screen' : 'multiply'}} aria-hidden>
    {look.ripples.map((event, i) => {
      const u = event.age / .48, opacity = Math.sin(Math.PI * u) * event.strength * (look.dark ? .38 : .2);
      return <ellipse key={i} cx={width / 2} cy={height * center} rx={width * (.04 + .53 * u)} ry={height * (.004 + .028 * u)}
        fill="none" stroke={look.dark ? '#7de9ed' : '#29b4cb'} strokeWidth={2.5 * (1 - u) + .5} opacity={opacity} />;
    })}
  </svg>;
};

/** Slow authored-air colour field, behind the ride; not a physical light measurement. */
export const StudyAtmosphere: React.FC<{look: StudyFrame | null}> = ({look}) => {
  const a = look?.atmosphere;
  if (!a) return null;
  return <AbsoluteFill style={{pointerEvents: 'none', opacity: a.amount,
    background: `radial-gradient(ellipse at ${a.position}% 60%, ${a.color}, transparent 65%), radial-gradient(ellipse at ${100 - a.position}% 30%, ${a.second}, transparent 60%)`}} />;
};
