// Colours for the lab's rounds: OKLCH ↔ hex, and a round's file from its pages (round45.mjs, round46.mjs).
import {writeFileSync} from 'node:fs';
import {COLLECTION} from '../../scripts/video/collection.js';

// OKLCH ↔ hex; out-of-gamut colours lose chroma until they fit
const lin = c => {c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;};
const gam = c => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
export function toLch(hex) {
  const n = parseInt(hex.slice(1), 16), r = lin(n >> 16), g = lin(n >> 8 & 255), b = lin(n & 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
export function toHex([L, C, h]) {
  for (let c = C, i = 0; i < 80; i++, c *= 0.97) {
    const A = c * Math.cos(h * Math.PI / 180), B = c * Math.sin(h * Math.PI / 180);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const v = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (v.every(x => x >= -0.0005 && x <= 1.0005)) return '#' + v.map(x => gam(Math.min(1, Math.max(0, x))).toString(16).padStart(2, '0')).join('');
  }
  return '#000000';
}
export const colour = v => typeof v === 'string' ? v : toHex(v);


/** A light scheme from its ground, bars, hot bar and sun: the line is a near-black in the bars' hue, the pencil a quiet step below the ground. */
export function lightScheme({paper, mass, accent, sun = accent, ink}) {
  const p = colour(paper), [pl, , ph] = toLch(p), [, , mh] = toLch(colour(mass)), line = colour(ink ?? [0.24, 0.02, mh]);
  return {accent: colour(accent), ink: line, mass: colour(mass), nightInk: p, nightPaper: line, paper: p, pencil: toHex([pl - 0.19, 0.012, ph]), sun: colour(sun)};
}

/** A dark scheme from its ground, bars, hot bar and moon: a cream line unless given, the pencil a quiet step above the ground. */
export function darkScheme({paper, mass, accent, sun = accent, ink = [0.94, 0.02, 90]}) {
  const p = colour(paper), [pl, , ph] = toLch(p), line = colour(ink);
  return {accent: colour(accent), ink: line, mass: colour(mass), nightInk: line, nightPaper: p, paper: p, pencil: toHex([pl + 0.25, 0.012, ph]), sun: colour(sun)};
}

/** Write candidates-SET.json. A page: {id, name, line, base?: collection key, versions: [[label, note, colours, look]]}. With a base, the
 * theme as it is comes first and a version overrides its colours and look; when only the ground changes, the pencil follows it. Without
 * one, a version's colours are a whole scheme and its look is complete. */
export function writeRound({set, round, about, source, prefix, pages}) {
  const schemes = {}, drafts = [];
  for (const page of pages) {
    const spec = page.base ? COLLECTION[page.base].spec : null, base = spec?.colours;
    const all = spec ? [['As it is', 'The theme in production.', {}, {}], ...page.versions] : page.versions;
    const variants = all.map(([label, note, colours = {}, look = {}], i) => {
      const c = {...base, ...Object.fromEntries(Object.entries(colours).map(([k, v]) => [k, colour(v)]))};
      if (base && colours.paper && !colours.pencil) { // the pencil keeps its distance from the ground
        const [pl, , ph] = toLch(c.paper), [bl] = toLch(base.paper), [nl, nc] = toLch(base.pencil);
        c.pencil = toHex([nl + pl - bl, nc, ph]);
      }
      if (base && colours.paper && base.nightPaper === base.paper) c.nightPaper = c.paper;
      const scheme = `${prefix}${page.id}${String.fromCharCode(65 + i)}`;
      schemes[scheme] = c;
      return {label, look: {...spec?.look, ...look, scheme}, note};
    });
    drafts.push({id: `${prefix}${page.id}`, name: page.name, source, line: page.line, ...(page.moments ? {moments: page.moments} : {}), variants});
  }
  writeFileSync(new URL(`./candidates-${set}.json`, import.meta.url), JSON.stringify({round, about, schemes, drops: {}, drafts}, null, 1) + '\n');
  console.log(`${set}: ${drafts.length} pages, ${Object.keys(schemes).length} versions`);
}
