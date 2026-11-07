// node inject.mjs FILE : copy ../../../lab.js into ../mock with FILE's PALETTES added to SCHEMES and DIMS.scheme
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {PALETTES} = await import(resolve(process.argv[2]));
let s = readFileSync(new URL('../../../lab.js', import.meta.url), 'utf8');
const ent = Object.entries(PALETTES).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n');
s = s.replace('};\nconst DIMS = {', ent + '\n};\nconst DIMS = {');
s = s.replace("risoDeep: 'Riso, deeper ink (test)'}", "risoDeep: 'Riso, deeper ink (test)', " + Object.keys(PALETTES).map(k => `${k}: '${k}'`).join(', ') + '}');
writeFileSync(new URL('../mock/lab.js', import.meta.url), s);
