/** The impact account the compiler optimizes: line.strike.v3. Search, refinement,
 * terminal selection, the production replay and the review all go through
 * `impactRuler`. Observation reads only already simulated frames: it never steps
 * physics. Other rulers are report rows only (tools/measure/strike.ts). */
import {CONTACT_IMPACT_CONTRACT, accountContactImpacts, contactSpeedGains, type ImpactTarget, type ContactImpactEvent} from '../../lib/contact_impact.ts';
import {STRIKE_V3_CONTRACT, observeMotion, observeMotionWindow, bodyMotion, strikePrefix, continueStrikes, accountStrikes, evaluateStrikes, evaluateStrikeEvents,
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
  evaluateEvents(events: readonly ContactImpactEvent[], targets: readonly ImpactTarget[], duration: number, survived: boolean): ImpactAssessment;
  evaluate(observed: ImpactObservation[], targets: readonly ImpactTarget[], duration: number, survived: boolean): ImpactEvaluation;
};
/** Event matching and validity used by search and whole-trajectory scoring. */
export type ImpactAssessment = {contract: string; events: ContactImpactEvent[]; targets: readonly ImpactTarget[];
  account: ReturnType<typeof accountContactImpacts>; valid: boolean};
/** Complete ride evaluation, including speed-gain diagnostics for review. */
export type ImpactEvaluation = ImpactAssessment & {speedGains: ReturnType<typeof contactSpeedGains>};

function strikeAccount(c: StrikeContract): ImpactAccount {
  return {
    id: c.id, matchFrames: CONTACT_IMPACT_CONTRACT.matchFrames,
    observe(engine, raw) {
      if (!raw.length) return [];
      const first = raw[0].frame, last = raw.at(-1)!.frame;
      if (engine.getLastFrameIndex() < last) throw new Error('strike observation requires a metered complete window');
      const contact = (f: number) => engine.hasContactAtFrame(f);
      // Frame 0 is the authored start state: no solve precedes it, so nothing is measured there.
      const head: ImpactObservation[] = first === 0 ? [{frame: 0, contact: contact(0), J: 0, bend: 0, solverGain: 0, gravityGain: 0, speedBefore: 0, impulse: [0, 0, 0]} as any] : [];
      const from = Math.max(first, 1);
      if (from > last) return head;
      if (typeof engine.readCachedMotionWindow === 'function') {
        const observed = engine.readCachedMotionWindow(from - 1, last, (data: ArrayLike<number>) => observeMotionWindow(from, data, c));
        return head.length ? [...head, ...observed] : observed;
      }
      // The independent judge has no packed window; the native engine reads whole-body motion directly.
      const read = typeof engine.bodyMotionAt === 'function' ? (f: number) => engine.bodyMotionAt(f) : (f: number) => bodyMotion(engine.getRider(f).ballisticState());
      const motions = [];
      for (let f = from - 1; f <= last; f++) motions.push(read(f));
      return [...head, ...observeMotion(from, motions, contact, c)];
    },
    prefix: observed => strikePrefix(observed as any, c),
    continue: (prefix, observed) => continueStrikes(prefix as any, observed as any, c),
    account: (events, targets) => accountStrikes(events as any, targets, c),
    evaluateEvents: (events, targets, duration, survived) => evaluateStrikeEvents(events as any, targets, duration, survived, c),
    evaluate(observed, targets, duration, survived) {
      return {...evaluateStrikes(observed as any, targets, duration, survived, c),
        speedGains: contactSpeedGains((observed as any[]).filter(f => f.frame <= duration))};
    },
  };
}
export const impactRuler = strikeAccount(STRIKE_V3_CONTRACT);
