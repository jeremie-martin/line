/** Adapter between the shared physical impact account and compiler search.
 * Contact reads never integrate physics; callers supply an already metered
 * trajectory and terminal state. Frozen historical reporting stays available. */
import {CONTACT_IMPACT_CONTRACT, observeContactImpacts, detectContactImpacts, accountContactImpacts,
  contactSpeedGains, type ContactImpactFrame, type ImpactTarget, type ContactImpactEvent} from '../../lib/contact_impact.ts';
import {effectiveBodyVelocity} from './motion_quality.ts';
import type {RawFrame} from '../../lib/detector.ts';

/** steepArrivalFrom: from this requested impact on, the arrival into the next catch
 * gets the steep, ask-driven heading and speed prior (as unguided catches do), with
 * weight steepArrivalWeight (default: the ordinary arrival weight); strongLookahead
 * scales the lookahead width and sample caps of the interval leading into it. */
export type ImpactSearchOptions = {extraWeight?: number; timingWeight?: number; engagementGainWeight?: number; releaseFrames?:number;
  steepArrivalFrom?: number; steepArrivalWeight?: number; strongLookahead?: number};
export function validateImpactSearchOptions(options:ImpactSearchOptions|undefined){
  if(!options)return;
  for(const [key,value] of Object.entries(options)){
    if(!['extraWeight','timingWeight','engagementGainWeight','releaseFrames','steepArrivalFrom','steepArrivalWeight','strongLookahead'].includes(key)||!Number.isFinite(value)||value<0||
      (key==='releaseFrames'&&(!Number.isSafeInteger(value)||value>6))||(key==='steepArrivalFrom'&&value>1))throw new Error('invalid impact search options');
  }
}
export type MusicalImpactEvaluation = ReturnType<typeof evaluateMusicalImpacts>;
export function impactFrames(engine: any, frames: readonly RawFrame[], terminalState?: Parameters<typeof effectiveBodyVelocity>[0]) {
  if (!frames.length) return [];
  const last = frames.at(-1)!.frame;
  if (engine.getLastFrameIndex() < last) throw new Error('impact observation requires a metered complete window');
  return observeContactImpacts(frames, typeof engine.hasContactAtFrame === 'function' ?
    frame => engine.hasContactAtFrame(frame) : frame => engine.getUpdatesAtFrame(frame).some((u: any) => u.type === 'CollisionUpdate'),
    effectiveBodyVelocity(terminalState ?? engine.getRider(last).ballisticState()));
}
export function evaluateMusicalImpacts(observed: readonly ContactImpactFrame[], targets: readonly ImpactTarget[], duration: number, survived: boolean) {
  const events = detectContactImpacts(observed).filter(e => e.onset <= duration);
  const account = accountContactImpacts(events, targets);
  return {contract: CONTACT_IMPACT_CONTRACT.id, events, targets, account,
    valid: survived && account.complete && account.matches.every(m => events[m.event].complete),
    speedGains: contactSpeedGains(observed.filter(f => f.frame <= duration))};
}
/** Additional local residuals supplement the first four musical coordinates;
 * response-memory layout remains stable. Targets/extra-event membership have
 * already been decided by the common one-to-one account. */
export function impactSearchResiduals(events: readonly ContactImpactEvent[], account: ReturnType<typeof accountContactImpacts>,
  currentTarget: number | undefined, from: number, to: number, options: ImpactSearchOptions = {}) {
  const match = currentTarget === undefined ? undefined : account.matches.find(m => m.target === currentTarget);
  const timing = match ? Math.sqrt(options.timingWeight ?? 1) * match.timingError : 0;
  const extra = Math.sqrt((options.extraWeight ?? 1) * account.unmatchedEvents.reduce((sum, i) => {
    const e = events[i]; return sum + (e.onset >= from && e.onset < to ? (e.raw / CONTACT_IMPACT_CONTRACT.veryStrong) ** 2 : 0);
  }, 0));
  return [timing, extra];
}
/** A sustained gain can evade every short burst band. This search preference
 * uses the same measured per-engagement strongest positive interval exposed
 * in independent review; its weight is not an impact-definition parameter. */
export function engagementGainResiduals(observed: readonly ContactImpactFrame[], from: number, to: number, options: ImpactSearchOptions = {}) {
  const weight = Math.sqrt(options.engagementGainWeight ?? 0);
  if (!weight) return [];
  let worst = 0;
  for (const e of contactSpeedGains(observed)) {
    if (e.end < from || e.start > to) continue;
    const limit = Math.max(.75, .1 * e.strongest.speedBefore);
    worst = Math.max(worst, Math.max(0, e.strongest.gain - limit) / limit);
  }
  return [weight * worst];
}
