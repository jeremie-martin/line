// Types of look.js (a plain module, so the browser loads it as is).
export type Look = {
  scheme: string; paper: 'whisper' | 'plain'; line: 'inking' | 'rail' | 'ink'; band: 'none' | 'bars' | 'fork' | 'iris';
  accent: 'heat' | 'loud'; bandHeight: 'low' | 'lowmid' | 'mid'; top: 'none' | 'sun' | 'title'; sunRider: string; sunY: string;
  drop: 'off' | 'night' | 'switch'; zoom: 'steady' | 'quiet'; ends: 'course' | 'none'; hits: 'v1' | 'none';
};
export const OPTIONS: Record<keyof Look, [string, Record<string, string>]>;
export const V1: Look;
export const THEMES: Record<string, {name: string; line: string; look: Partial<Look>}>;
export const PLAIN: Partial<Look>;
export function resolveLook(name?: string | null, overrides?: Record<string, string>): Look;
