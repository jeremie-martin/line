import React from 'react';
import {AbsoluteFill} from 'remotion';
import type {StudyFrame} from './looks';

/** Map darkness to coloured ink, preserving the original black centre and white paper. */
export const StudyRide: React.FC<{look: StudyFrame | null; children: React.ReactNode}> = ({look, children}) => {
  if (!look) return <>{children}</>;
  const ink = look.ink;
  return <AbsoluteFill style={{transform: `translateY(${look.y}px) scale(${look.scale})`, transformOrigin: '50% 35%',
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
