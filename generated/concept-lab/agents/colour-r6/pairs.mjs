// Drop pairs: the light scheme's night tokens taken from a dark partner's paper and ink; the light scheme's accent is kept.
// Prints night-ink Lc, the kept accent on the partner's paper, and the paper lightness/hue step. /usr/bin/node pairs.mjs
import {readFileSync} from 'node:fs';
import * as K from './colour.mjs';
import {CANDIDATES} from './schemes.js';
const src = readFileSync(new URL('../../lab.js', import.meta.url), 'utf8');
const S = {...Function('return ' + src.match(/const SCHEMES = (\{[\s\S]*?\n\});/)[1])(), ...CANDIDATES};
const PAIRS = [['graphite', 'black'], ['sumi', 'black'], ['mauve', 'plum'], ['slate', 'midnight'], ['hokusai', 'midnight'], ['olive', 'moss'], ['lagoon', 'moss'], ['dune', 'espresso'], ['bauhaus', 'black']];
console.log('light → dark       | nightInk Lc | accent kept on dark paper Lc | accent vs dark band ΔL | paper hue step (deg)');
for (const [a, b] of PAIRS) {
  const p = S[a], q = S[b], hue = Math.abs(((K.lch(p.paper)[2] - K.lch(q.paper)[2] + 540) % 360) - 180);
  console.log(`${a} → ${b}`.padEnd(19), '|', Math.abs(K.apca(q.ink, q.paper)).toFixed(0).padStart(5), '|', Math.abs(K.apca(p.accent, q.paper)).toFixed(0).padStart(5),
    '|', Math.abs(K.lch(p.accent)[0] - K.lch(q.ink)[0]).toFixed(2), '|', K.lch(p.paper)[1] < 0.015 ? 'neutral paper' : hue.toFixed(0));
}
