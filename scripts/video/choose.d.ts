// Types of choose.js (a plain module, so the browser loads it as is).
import type {Look} from './look.js';
export const SHARES: {readonly light: number; readonly drop: number; readonly variant: number};
export const LIGHT: readonly string[];
export const DARK: readonly string[];
/** The themes as they are drawn: lists of themes too alike to count separately, and every other theme alone. */
export const GROUPS: {readonly light: readonly (readonly string[])[]; readonly dark: readonly (readonly string[])[]};
/** The look of one video from its key; the drop partner only for a light theme on a song with a drop. */
export function chooseLook(key: string, options: {hasDrop: boolean; shares?: {light: number; drop: number; variant: number}}): {theme: string; variant: Partial<Look> | null; partner: string | null; look: Look};
