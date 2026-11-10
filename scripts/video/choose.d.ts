// Types of choose.js (a plain module, so the browser loads it as is).
import type {Look} from './look.js';
export const SHARES: {readonly light: number; readonly drop: number};
export const LIGHT: readonly string[];
export const DARK: readonly string[];
/** The look of one video from its key; the drop partner only for a light theme on a song with a drop. */
export function chooseLook(key: string, options: {hasDrop: boolean; shares?: {light: number; drop: number}}): {theme: string; partner: string | null; look: Look};
