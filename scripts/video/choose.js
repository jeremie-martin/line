// The look of each video in a batch: a theme from the collection, and for a light theme on a song with a drop, sometimes a dark
// partner at the drop. Mostly light (owner, 11 November), a drop only some of the time, never chosen by hand. Pure: the same
// key always gives the same look.
import {COLLECTION, DROPS} from './collection.js';
import {SCHEMES} from './palettes.js';
import {resolveLook} from './look.js';

/** The shares the choice follows: light themes in all videos, and light-theme videos given a drop when their song has one. */
export const SHARES = {light: 0.75, drop: 0.5};

const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const lightness = hex => {const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2104542553 * Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) + 0.793617785 * Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    - 0.0040720468 * Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);};
/** Light themes: ground OKLab lightness of at least 0.5. */
export const LIGHT = Object.keys(COLLECTION).filter(k => lightness(COLLECTION[k].spec.colours.paper) >= 0.5);
export const DARK = Object.keys(COLLECTION).filter(k => !LIGHT.includes(k));

// a number in [0, 1) from a key and a purpose (FNV-1a, then a 32-bit mix)
function unit(key, purpose) {
  let h = 2166136261;
  for (const c of `${key}\u0000${purpose}`) h = Math.imul(h ^ c.codePointAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 2 ** 32;
}
const pick = (list, u) => list[Math.min(list.length - 1, Math.floor(u * list.length))];
function weighted(weights, u) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0); let x = u * total;
  for (const [k, w] of Object.entries(weights)) {if ((x -= w) < 0) return k;}
  return Object.keys(weights).at(-1);
}

/** The look of one video: `key` names it for good (e.g. the ride's id); `hasDrop` says whether its song has a drop.
 * Returns the theme, the drop partner (or null) and the complete look to render. */
export function chooseLook(key, {hasDrop, shares = SHARES} = {}) {
  const light = unit(key, 'ground') < shares.light, theme = pick(light ? LIGHT : DARK, unit(key, 'theme'));
  const partners = DROPS[theme], partner = light && hasDrop && partners && unit(key, 'drop') < shares.drop ? weighted(partners, unit(key, 'partner')) : null;
  const scheme = partner ? `${COLLECTION[theme].id}+${COLLECTION[partner]?.id ?? `drop-${partner}`}` : COLLECTION[theme].id;
  if (!SCHEMES[scheme]) throw new Error(`no scheme for ${theme} → ${partner}`);
  return {theme, partner, look: resolveLook(theme, partner ? {scheme, drop: 'switch'} : {})};
}
