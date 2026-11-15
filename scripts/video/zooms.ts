/** The zoom lanes written for each song (productions/<song>/zooms.ts), for the scene builder. A song without an entry keeps the
 * steady zoom. The lanes follow the song's music, so every reading of a song shares them. */
import petrunko from '../../productions/petrunko_selection/zooms.ts';
import trouble from '../../productions/trouble_50s/zooms.ts';
import tiki from '../../productions/tiki_tiki_48s/zooms.ts';

export type ZoomLane = {id: string; name: string; about: string; keyframes: Array<{t: number; wide: number}>};
export const ZOOMS: Record<string, ZoomLane[]> = {petrunko_selection: petrunko, trouble_50s: trouble, tiki_tiki_48s: tiki};
