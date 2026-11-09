// The judgments of a set, for the assistant: node generated/concept-lab/rate/report.mjs <set> [top=32]
// Writes generated/concept-lab/docs/owner-answers/ratings/<set>-report.md (local only, like the answers): the ranking (model.js,
// the same fit as the results page), a varied best `top` (greedy by strength, penalised for looking like one already chosen:
// paper, bars and accent close in OKLab, the same band and drop), every note, and the closest calls (slow or equal duels).
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {fold, fit} from './model.js';

const [set, topArg] = process.argv.slice(2), top = Number(topArg) || 32;
if (!/^[a-z0-9-]{1,80}$/.test(set ?? '')) throw new Error('usage: report.mjs <set> [top]');
const HERE = import.meta.dirname, S = JSON.parse(readFileSync(join(HERE, 'sets', set, 'set.json'), 'utf8'));
// the set's judgments and those of the sets it builds on (the same themes, the same ids), in the order they were saved
const logOf = s => {const f = join(HERE, '../docs/owner-answers/ratings', `${s}.jsonl`); return existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];};
const events = [...(S.buildsOn ?? []), set].flatMap(logOf).sort((a, b) => (a.savedAt ?? '').localeCompare(b.savedAt ?? ''));
const record = fold(events), f = fit(S.themes, record, {top}), byId = new Map(S.themes.map(t => [t.id, t]));

// OKLab distance between two themes' key colours, plus their look differences
const lin = v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const oklab = hex => {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b),
    s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const dist = (a, b) => Math.hypot(...oklab(a).map((x, i) => x - oklab(b)[i]));
const likeness = (x, y) => {
  const cx = x.spec.colours, cy = y.spec.colours, d = (dist(cx.paper, cy.paper) + dist(cx.mass, cy.mass) + dist(cx.accent, cy.accent)) / 3;
  return Math.max(0, 1 - d / 0.15) * (x.spec.look.band === y.spec.look.band ? 1 : 0.7) * (x.spec.look.drop === y.spec.look.drop ? 1 : 0.8);
};
const chosen = [];
for (const r of f.order.filter(r => r.verdict !== 'cut')) {
  if (chosen.length >= top) break;
  const t = byId.get(r.id), worst = Math.max(0, ...chosen.map(c => likeness(t, byId.get(c.id))));
  if (worst < 0.6) chosen.push(r); // too like one already in: left for a later round's variety, not chosen twice
}
const word = {love: 'Love', keep: 'Keep', unsure: 'Unsure', cut: 'Cut'};
const notesOf = id => record.notes.filter(n => n.themes.includes(id)).map(n => `${n.themes.length > 1 ? `(with ${byId.get(n.themes.find(x => x !== id)).label}) ` : ''}“${n.text}”`);
const duels = record.duels.filter(d => d.outcome !== 'pass');
const close = record.duels.filter(d => d.outcome === 'equal' || d.outcome === 'pass' || d.ms > 8000);
const lines = [
  `# ${S.title} (${set}): the judgments so far`, '',
  `${Object.keys(record.verdicts).length} of ${S.themes.length} sorted, ${duels.length} duels (${record.duels.length - duels.length} passed), ${record.notes.length} notes. ` +
  `Fit: Bradley–Terry with ties (tie parameter ${f.tie.toFixed(2)}), verdicts as anchors; P(best ${top}) by sampling the uncertainty. Renderer ${S.renderer}.`, '',
  `## A varied best ${top} (${chosen.length})`, '',
  ...chosen.map((r, i) => `${i + 1}. **${byId.get(r.id).label}** (${r.id}): strength ${r.strength.toFixed(2)} ± ${r.se.toFixed(2)}, P ${Math.round(r.pTop * 100)}%, ${r.verdict ? word[r.verdict] : 'unsorted'}, ${r.duels} duels`),
  '', '## Every theme, strongest first', '', '| # | Theme | Verdict | Strength | P(best) | Duels | Notes |', '|---|---|---|---|---|---|---|',
  ...f.order.map(r => `| ${r.rank} | ${byId.get(r.id).label} | ${r.verdict ? word[r.verdict] : '–'} | ${r.strength.toFixed(2)} ± ${r.se.toFixed(2)} | ${Math.round(r.pTop * 100)}% | ${r.duels} | ${notesOf(r.id).join(' ').replace(/\|/g, '/')} |`),
  '', '## Close calls (equal, passed or slower than 8 s)', '',
  ...close.map(d => `- ${byId.get(d.left).label} vs ${byId.get(d.right).label}: ${d.outcome}${d.ms ? `, ${(d.ms / 1000).toFixed(1)} s` : ''}`),
];
const out = join(HERE, '../docs/owner-answers/ratings', `${set}-report.md`);
writeFileSync(out, lines.join('\n') + '\n');
console.log(`${out}: ${f.order.length} themes, ${duels.length} duels, a varied ${chosen.length}`);
