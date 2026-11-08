// A lab film, written by the video renderer's own writer (scripts/video/write.ts): exactly what a finished video of this look
// would be. node generated/concept-lab/film.mjs song=circus c=hokusai [m=band:fork,...] [from=0 to=…] [rides=old] [width=1080] out=FILE.mp4
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveLook} from '../../scripts/video/look.js';
import {writeVideo} from '../../scripts/video/write.ts';
import {PRESETS} from './presets.js';
const a = Object.fromEntries(process.argv.slice(2).map(s => {const i = s.indexOf('='); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 1)];}));
const song = a.song ?? 'petrunko', c = a.c ?? 'swatch', preset = PRESETS.find(p => p.id === c);
if (!preset) throw new Error(`no look ${c}: ${PRESETS.map(p => p.id).join(', ')}`);
const look = resolveLook(null, {...preset.mix, ...Object.fromEntries((a.m ?? '').split(',').filter(Boolean).map(kv => kv.split(':')))});
const scene = JSON.parse(readFileSync(join(import.meta.dirname, a.rides === 'old' ? 'data-r5' : 'data', `${song}.json`), 'utf8'));
await writeVideo({scene, look, out: a.out ?? join(import.meta.dirname, 'films', `${song}-${c}.mp4`),
  from: a.from === undefined ? 0 : +a.from, to: a.to === undefined ? scene.duration : +a.to, width: a.width === undefined ? 1080 : +a.width});
