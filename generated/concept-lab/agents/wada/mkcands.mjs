// shortlist.json → mock/cands.js (lab-format tokens keyed w<combo>) for rendering
import {readFileSync, writeFileSync} from 'node:fs';
const here = new URL('.', import.meta.url).pathname;
const s = JSON.parse(readFileSync(here + (process.argv[2] ?? 'shortlist.json')));
writeFileSync(here + 'mock/cands.js', 'export const CANDS = ' + JSON.stringify(Object.fromEntries(s.map(o => ['w' + o.combo, o.scheme])), null, 1) + ';\n');
