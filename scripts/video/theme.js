// Resolve the colours for one frame: drop partner → intensity grade.
// No canvas or previous-frame state. The caches memoize only scheme, response and quantized intensity.
import {SCHEMES, DROP_SCHEMES} from './palettes.js';
import {GRADES, gradeScheme} from './grade.js';
import {rgb} from './colour.js';

/** Hand-placed song cues snap to the strongest nearby matched hit; ties keep the first hit.
 * The entry and exit windows differ deliberately. With no hit nearby, the authored cue stays. */
export function dropSpan(cue, hitTimes) {
  if (!cue) return null;
  const near = (t, window) => hitTimes.filter(h => Math.abs(h.t - t) < window)
    .reduce((a, b) => (!a || b.s > a.s ? b : a), null)?.t ?? t;
  return [near(cue[0], 0.4), near(cue[1], 0.8)];
}

export function createTheme(drop) {
  const switched = new Map(), graded = new WeakMap();
  return function themeAt(time, intensity, look) {
    const inDrop = drop && time >= drop[0] && time < drop[1];
    const original = SCHEMES[look.scheme], partner = DROP_SCHEMES[look.scheme];
    let scheme = original;
    if (look.drop === 'switch' && inDrop && partner) {
      // Carry the hot note and sun across the switch, preserving the theme's thread.
      if (!switched.has(original)) switched.set(original, {...SCHEMES[partner], accent: original.accent, sun: original.sun ?? original.accent});
      scheme = switched.get(original);
    }
    if (Object.hasOwn(GRADES, look.paper)) {
      const q = Math.round(intensity * 200), key = `${look.paper} ${q}`;
      const cache = graded.get(scheme) ?? graded.set(scheme, new Map()).get(scheme);
      if (!cache.has(key)) cache.set(key, gradeScheme(scheme, look.paper, q / 200));
      scheme = cache.get(key);
    }
    const {paper} = scheme;
    return {
      scheme, paper, ink: scheme.ink, pencil: scheme.pencil, band: scheme.mass, sun: scheme.sun ?? scheme.accent, accent: scheme.accent,
      // Iris is lit toward white on a dark ground
      irisLight: rgb(paper).reduce((sum, v) => sum + v, 0) < 0.9 * 255,
    };
  };
}
