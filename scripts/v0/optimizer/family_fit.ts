/** Where each construction family costs least (`family_fit.json`, fitted by tools/research/family_fit.ts from saved V7.1
 * rides): the mean loss of a section by family and context. The planner draws its families as before and places them
 * among the phrases where they cost least (intentional_repertoire.ts). */
import fit from './family_fit.json' with {type: 'json'};

export const ASK_BINS = [.3, .6, .8], LENGTH_BINS = [16, 28];
/** A section's context: its catch's strength ask × its length in frames. */
export const contextOf = (ask: number, frames: number) =>
  ASK_BINS.filter(b => ask >= b).length * (LENGTH_BINS.length + 1) + LENGTH_BINS.filter(b => frames >= b).length;
export const familyKey = (construction: string, guidance: string) => `${construction}${guidance === 'forbidden' ? ':open' : ''}`;

const table: Record<string, number> = fit.cost, fallback = new Map<number, number>();
for (const ctx of new Set(Object.keys(table).map(k => Number(k.split('|')[1])))) {
  const all = Object.entries(table).filter(([k]) => Number(k.split('|')[1]) === ctx).map(([, v]) => v);
  fallback.set(ctx, all.reduce((a, b) => a + b, 0) / all.length);
}
/** The fitted loss of family `key` in context `ctx`; the context's mean where the family was too rare to fit. */
export const familyCost = (key: string, ctx: number) => table[`${key}|${ctx}`] ?? fallback.get(ctx) ?? 0;

import model from './family_model.json' with {type: 'json'};
/** The placement model (tools/research/family_model.py, fitted on V7.1 rides): a section's expected loss from its family
 * and its context as the planner sees it. Gradient-boosted trees, evaluated directly. */
export function familyLoss(construction: string, guidance: string, x: {impact: number | null; speed: number | null;
  nextImpact: number | null; nextSpeed: number | null; quiet: number}, frames: number): number {
  const f = [...model.families.map(name => name === construction ? 1 : 0), guidance === 'forbidden' ? 1 : 0,
    x.impact ?? 0, x.speed ?? .5, x.nextImpact ?? 0, x.nextSpeed ?? .5, x.quiet, frames];
  let value = model.initial;
  for (const t of model.trees) {
    let n = 0;
    while (!t.leaf[n]) n = f[t.feature[n]] <= t.threshold[n] ? t.left[n] : t.right[n];
    value += t.value[n];
  }
  return value;
}
