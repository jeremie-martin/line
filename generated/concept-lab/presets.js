// The lab's looks: the plain look the colour questions compare in, the compiler's plain review look, and the themes. Shared by
// the lab page and the film tool (film.mjs), so a film named after a look is that look.
import {THEMES, resolveLook} from '../../scripts/video/look.js';
export const PRESETS = [
  {id: 'swatch', name: 'Swatch', line: 'The plain look used to compare colours: the bars, the hits, Follows direction.', mix: resolveLook(null, {band: 'bars'})},
  {id: 'plain', name: 'Plain', line: 'The compiler’s review clips: the ride alone, black on white.', mix: resolveLook('plain')},
  ...Object.entries(THEMES).map(([id, t]) => ({id, name: t.name, line: t.line, mix: resolveLook(id)})),
];
