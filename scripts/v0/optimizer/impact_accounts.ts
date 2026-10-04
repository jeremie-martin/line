/** Impact accounts the compiler can optimize, behind one interface.
 *
 * Search, refinement, terminal selection, the production replay and the review all
 * go through `impactAccount(id)`, so a measurement change is one registry entry and
 * never a scattered set of branches. Observation reads only already simulated
 * frames: it never steps physics.
 *  - line.strike.v1: centre-of-mass strikes (scripts/lib/strike_impact.ts), strength
 *    = centre-of-mass redirection over the event.
 *  - line.strike.v2: the same events, timing and matching; strength = the change of
 *    the rider's whole-body motion (travel and spin) within 50 ms, chosen on the
 *    owner's blind pair judgments.
 *  (line.contact-impact.v1, their predecessor, is kept only as a research
 *  diagnostic in tools/measure.) */
export const DEFAULT_IMPACT_ACCOUNT = 'line.strike.v2';
import {CONTACT_IMPACT_CONTRACT, accountContactImpacts, contactSpeedGains, type ImpactTarget, type ContactImpactEvent} from '../../lib/contact_impact.ts';
import {STRIKE_CONTRACT, STRIKE_V2_CONTRACT, observeStrikes, observeMotion, bodyMotion, centreVelocity, strikePrefix, continueStrikes, accountStrikes, evaluateStrikes,
  type StrikeContract} from '../../lib/strike_impact.ts';
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

function strikeAccount(c: StrikeContract): ImpactAccount {
  const motion = c.strength === 'motion';
  return {
    id: c.id, matchFrames: CONTACT_IMPACT_CONTRACT.matchFrames,
    observe(engine, raw) {
      if (!raw.length) return [];
      const first = raw[0].frame, last = raw.at(-1)!.frame;
      if (engine.getLastFrameIndex() < last) throw new Error('strike observation requires a metered complete window');
      const contact = typeof engine.hasContactAtFrame === 'function' ? (f: number) => engine.hasContactAtFrame(f)
        : (f: number) => engine.getUpdatesAtFrame(f).some((u: any) => u.type === 'CollisionUpdate');
      // Frame 0 is the authored start state: no solve precedes it, so nothing is measured there.
      const head: ImpactObservation[] = first === 0 ? [{frame: 0, contact: contact(0), J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0,
        ...(motion ? {impulse: [0, 0, 0]} : {})} as any] : [];
      const from = Math.max(first, 1);
      if (from > last) return head;
      if (motion) {
        const motions = [];
        for (let f = from - 1; f <= last; f++) motions.push(bodyMotion(engine.getRider(f).ballisticState()));
        return [...head, ...observeMotion(from, motions, contact, c)];
      }
      const velocities = [];
      for (let f = from - 1; f <= last; f++) velocities.push(centreVelocity(engine.getRider(f).ballisticState()));
      return [...head, ...observeStrikes(from, velocities, contact, c)];
    },
    prefix: observed => strikePrefix(observed as any, c),
    continue: (prefix, observed) => continueStrikes(prefix as any, observed as any, c),
    account: (events, targets) => accountStrikes(events as any, targets, c),
    evaluate(observed, targets, duration, survived) {
      return {...evaluateStrikes(observed as any, targets, duration, survived, c),
        speedGains: contactSpeedGains((observed as any[]).filter(f => f.frame <= duration))};
    },
  };
}
const strikeV1 = strikeAccount(STRIKE_CONTRACT), strikeV2 = strikeAccount(STRIKE_V2_CONTRACT);

const ACCOUNTS: Record<string, ImpactAccount> = {[strikeV1.id]: strikeV1, [strikeV2.id]: strikeV2};
export const IMPACT_ACCOUNT_IDS = Object.keys(ACCOUNTS);
export type ImpactAccountId = keyof typeof ACCOUNTS;
export function impactAccount(id: string): ImpactAccount {
  const account = ACCOUNTS[id];
  if (!account) throw new Error('unknown impact contract');
  return account;
}
