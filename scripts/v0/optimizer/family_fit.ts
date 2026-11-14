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
