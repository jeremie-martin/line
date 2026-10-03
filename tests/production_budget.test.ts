import {describe, expect, it} from 'vitest';
import {productionBudget, BUDGET_PER_RIDE_FRAME} from '../scripts/v0/optimizer/production_budget.ts';
import {validateAutomaticProductionRequest} from '../scripts/gallery/repertoire_catalog.ts';

describe('production allowance', () => {
  it('scales with ride length', () => {
    expect(productionBudget(44)).toBe(BUDGET_PER_RIDE_FRAME * (44 * 40 + 21));
    expect(productionBudget(180) / productionBudget(45)).toBeGreaterThan(3.9);
  });
  it('defaults an automatic request to the standard allowance', () => {
    const r = validateAutomaticProductionRequest({mode: 'production', song: 'luna_bala_44s', seed: 1, creative: {}});
    expect(r.budget).toBe(productionBudget(44));
    expect(validateAutomaticProductionRequest({mode: 'production', song: 'luna_bala_44s', seed: 1, budget: 1500000, creative: {}}).budget).toBe(1500000);
  });
  it('accepts saved requests with a zero reference allowance and rejects any other', () => {
    expect(() => validateAutomaticProductionRequest({mode: 'production', song: 'luna_bala_44s', seed: 1, referenceBudget: 0, creative: {}})).not.toThrow();
    expect(() => validateAutomaticProductionRequest({mode: 'production', song: 'luna_bala_44s', seed: 1, referenceBudget: 40000, creative: {}})).toThrow('retired');
  });
});
