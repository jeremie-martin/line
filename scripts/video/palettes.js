// The schemes: the colours a look is drawn in. Each production theme's scheme is named by its theme's id (collection.js); a drop
// pairing is its own scheme; graphite is the default look's (V1, the plain review clips and the lab's Swatch).
// A scheme is colours only. Tokens: paper, ink, pencil, mass (the bars), accent, sun?, tone?, nightPaper, nightInk. The last
// three are part of each judged specification (its identity), though no response draws them any more.
// The library of earlier rounds (about 200 named schemes, their variants and tiers) is in git history before 11 November.
import {COLLECTION, DROPS, DROP_ONLY} from './collection.js';

export const SCHEMES = {
  graphite: {tone: '#eef2f8', paper: '#ffffff', ink: '#15181d', pencil: '#b4bcc8', mass: '#3b414a', accent: '#d3262e', nightPaper: '#14171d', nightInk: '#eef1f5'},
};
export const SCHEME_NAMES = {graphite: 'Graphite & red'};
/** The drop switch (look.js drop 'switch'): at the song's drop a scheme hands over to its partner's colours. */
export const DROP_SCHEMES = {};

// The collection's themes: each scheme is named by its theme's id, with its drop partner as judged, exactly as the judging stills
// were drawn (rate/freeze.mjs), so these colours are the judged ones and no named scheme is shared.
for (const {name, id, spec} of Object.values(COLLECTION)) {
  SCHEMES[id] = spec.colours; SCHEME_NAMES[id] = name;
  if (spec.drop) {SCHEMES[`${id}-drop`] = spec.drop; SCHEME_NAMES[`${id}-drop`] = `${name}, drop partner`; DROP_SCHEMES[id] = `${id}-drop`;}
}

// A pairing's scheme is the light theme's colours under the name `<light id>+<dark id>`, handing over to the dark theme's at the drop,
// so a video's look names its pair exactly and the judged themes stay as they were.
for (const [key, {name, colours}] of Object.entries(DROP_ONLY)) {SCHEMES[`drop-${key}`] = colours; SCHEME_NAMES[`drop-${key}`] = name;}
for (const [light, partners] of Object.entries(DROPS)) for (const dark of Object.keys(partners)) {
  const a = COLLECTION[light].id, b = COLLECTION[dark]?.id ?? `drop-${dark}`;
  // a copy: the drop switch caches per scheme object
  SCHEMES[`${a}+${b}`] = {...SCHEMES[a]}; SCHEME_NAMES[`${a}+${b}`] = `${COLLECTION[light].name} → ${(COLLECTION[dark] ?? DROP_ONLY[dark]).name}`; DROP_SCHEMES[`${a}+${b}`] = b;
}
