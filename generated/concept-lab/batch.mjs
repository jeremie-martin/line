// What a batch of videos looks like under the chooser (scripts/video/choose.js), at three light shares: the same forty videos,
// drawn each time.   node generated/concept-lab/batch.mjs   → candidates-batch.json; batch.html shows the stills.
import {writeFileSync} from 'node:fs';
import {COLLECTION} from '../../scripts/video/collection.js';
import {chooseLook, SHARES} from '../../scripts/video/choose.js';

const N = 40, schemes = {}, drafts = [];
for (const light of [0.75, 0.6, 0.5]) {
  const variants = Array.from({length: N}, (_, i) => {
    const {theme, variant, look} = chooseLook(`batch-${i}`, {hasDrop: false, shares: {...SHARES, light}});
    schemes[look.scheme] = COLLECTION[theme].spec.colours;
    return {label: COLLECTION[theme].name + (variant ? ` (${Object.values(variant).join(', ')})` : ''), look, note: ''};
  });
  // the lab shows ten options a page at most here, so each share is four pages of ten
  for (let i = 0; i < N; i += 10) drafts.push({id: `batch${light * 100}-${i / 10}`, name: `Forty videos, light themes ${light * 100} % of the time (${i + 1}–${i + 10})`, source: 'Batch', line: '', variants: variants.slice(i, i + 10)});
}
writeFileSync(new URL('./candidates-batch.json', import.meta.url), JSON.stringify({round: 51, about: 'Forty videos as the chooser draws them, at three light shares.', schemes, drops: {}, drafts}, null, 1) + '\n');
