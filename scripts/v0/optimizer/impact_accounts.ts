/** Impact accounts the compiler can optimize, behind one interface.
 *
 * Search, refinement, terminal selection, the production replay and the review all
 * go through `impactAccount(id)`, so a measurement change is one registry entry and
 * never a scattered set of branches. Observation reads only already simulated
 * frames: it never steps physics.
 *  - line.strike.v1: centre-of-mass strikes (scripts/lib/strike_impact.ts), the
 *    product's impact account. (line.contact-impact.v1, its predecessor, is kept
 *    only as a research diagnostic in tools/measure.) */
export const DEFAULT_IMPACT_ACCOUNT = 'line.strike.v1';
import {CONTACT_IMPACT_CONTRACT, accountContactImpacts, contactSpeedGains, type ImpactTarget, type ContactImpactEvent} from '../../lib/contact_impact.ts';
import {STRIKE_CONTRACT, observeStrikes, centreVelocity, strikePrefix, continueStrikes, accountStrikes, evaluateStrikes} from '../../lib/strike_impact.ts';
import type {RawFrame} from '../../lib/detector.ts';

/** Per-frame observation shared by every account: contact plus the speed-gain terms. */
export type ImpactObservation = {frame: number; contact: boolean; solverGain: number; gravityGain: number; speedBefore: number};
export type ImpactAccount = {
  id: string;
  matchFrames: number;
  /** Observe frames `raw` (contiguous, already simulated by `engine`). */
  observe(engine: any, raw: readonly RawFrame[], terminalState?: any): ImpactObservation[];
  prefix(observed: ImpactObservation[]): unknown;
  continue(prefix: unknown, observed: ImpactObservation[]): ContactImpactEvent[];
  account(events: readonly ContactImpactEvent[], targets: readonly ImpactTarget[]): ReturnType<typeof accountContactImpacts>;
  evaluate(observed: ImpactObservation[], targets: readonly ImpactTarget[], duration: number, survived: boolean): ImpactEvaluation;
};
/** Complete evaluation of a ride under one account (shared by search, refinement,
 * final replay, production and review). */
export type ImpactEvaluation = {contract: string; events: ContactImpactEvent[]; targets: readonly ImpactTarget[];
  account: ReturnType<typeof accountContactImpacts>; valid: boolean; speedGains: ReturnType<typeof contactSpeedGains>};

const strikeV1: ImpactAccount = {
  id: STRIKE_CONTRACT.id, matchFrames: CONTACT_IMPACT_CONTRACT.matchFrames,
  observe(engine, raw) {
    if (!raw.length) return [];
    const first = raw[0].frame, last = raw.at(-1)!.frame;
    if (engine.getLastFrameIndex() < last) throw new Error('strike observation requires a metered complete window');
    const contact = typeof engine.hasContactAtFrame === 'function' ? (f: number) => engine.hasContactAtFrame(f)
      : (f: number) => engine.getUpdatesAtFrame(f).some((u: any) => u.type === 'CollisionUpdate');
    // Frame 0 is the authored start state: no solve precedes it, so nothing is measured there.
    const head: ImpactObservation[] = first === 0 ? [{frame: 0, contact: contact(0), J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0} as any] : [];
    const from = Math.max(first, 1), velocities = [];
    for (let f = from - 1; f <= last; f++) velocities.push(centreVelocity(engine.getRider(f).ballisticState()));
    return [...head, ...(from <= last ? observeStrikes(from, velocities, contact) : [])];
  },
  prefix: observed => strikePrefix(observed as any),
  continue: (prefix, observed) => continueStrikes(prefix as any, observed as any),
  account: (events, targets) => accountStrikes(events as any, targets),
  evaluate(observed, targets, duration, survived) {
    return {...evaluateStrikes(observed as any, targets, duration, survived),
      speedGains: contactSpeedGains((observed as any[]).filter(f => f.frame <= duration))};
  },
};

const ACCOUNTS: Record<string, ImpactAccount> = {[strikeV1.id]: strikeV1};
export const IMPACT_ACCOUNT_IDS = Object.keys(ACCOUNTS);
export type ImpactAccountId = keyof typeof ACCOUNTS;
export function impactAccount(id: string): ImpactAccount {
  const account = ACCOUNTS[id];
  if (!account) throw new Error('unknown impact contract');
  return account;
}
