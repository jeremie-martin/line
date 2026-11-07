import {resolve} from 'node:path';
const {PALETTES} = await import(resolve(process.argv[2]));
const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const L = h => {const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16))); const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; return Math.round(y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y);};
for (const [k, p] of Object.entries(PALETTES)) console.log(k.padEnd(10), ['paper', 'ink', 'pencil', 'mass', 'accent'].map(t => `${t}=${L(p[t])}`).join(' '), ` |ink-paper|=${Math.abs(L(p.ink) - L(p.paper))} |pencil-paper|=${Math.abs(L(p.pencil) - L(p.paper))} |acc-mass|=${Math.abs(L(p.accent) - L(p.mass))} |mass-paper|=${Math.abs(L(p.mass) - L(p.paper))}`);
