/**
 * Production-overlay impact contract.
 *
 * There is intentionally no compatibility fallback here. A v2 overlay must
 * provide the normalized current scorer value as `impactMeasured`; retired
 * preview fields must not drive presentation or effects.
 */
export type ImpactContact = {
  t: number;
  impactMeasured: number | null;
};

export const impactStrength = (contact: ImpactContact): number =>
  contact.impactMeasured ?? 0;

/** Decaying, clamped accumulator of recent impacts at time `t` (seconds). */
export function traumaAt(
  t: number,
  contacts: readonly ImpactContact[],
  config: { decayPerSec: number; gain: number; minImpact: number; power: number },
): number {
  let trauma = 0;
  for (const contact of contacts) {
    const strength = impactStrength(contact);
    if (contact.t > t || strength < config.minImpact) continue;
    trauma += strength * config.gain * Math.exp(-(t - contact.t) * config.decayPerSec);
  }
  return Math.pow(Math.min(1, trauma), config.power);
}
