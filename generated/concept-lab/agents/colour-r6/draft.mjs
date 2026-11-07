// Scratch: print OKLCH of hexes and draft colours. /usr/bin/node draft.mjs '#hex' ... | L,C,h:...
import * as K from './colour.mjs';
for (const x of process.argv.slice(2)) {
  if (x.startsWith('#')) console.log(x, K.lch(x).map(v => v.toFixed(3)).join(' '));
  else {const [L, C, h] = x.split(',').map(Number); try {console.log(x, K.fromLch(L, C, h));} catch (e) {console.log(x, e.message);}}
}
