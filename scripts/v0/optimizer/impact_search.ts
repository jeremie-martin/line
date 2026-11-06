/** Adapter between the shared physical impact account and compiler search. */
import {CONTACT_IMPACT_CONTRACT, contactSpeedGains, type ContactImpactFrame, type ContactImpactEvent, type accountContactImpacts} from '../../lib/contact_impact.ts';

/** steepArrivalFrom: the centre of the smooth step over which the arrival into the
 * next catch takes on the steep, ask-driven heading and speed prior (as unguided
 * catches do): none 0.2 below it, all of it 0.2 above (arc_evaluate.ts steepArrival);
 * uprightArrival weighs a penalty on arriving head-down or backward at such a catch. */
export type ImpactSearchOptions = {engagementGainWeight?: number; steepArrivalFrom?: number; uprightArrival?: number};
export function validateImpactSearchOptions(options:ImpactSearchOptions|undefined){
  if(!options)return;
  for(const [key,value] of Object.entries(options)){
    if(!['engagementGainWeight','steepArrivalFrom','uprightArrival'].includes(key)||!Number.isFinite(value)||value<0||
      (key==='steepArrivalFrom'&&value>1))throw new Error('invalid impact search options');
  }
}
/** Additional local residuals supplement the first four musical coordinates;
 * response-memory layout remains stable. Targets/extra-event membership have
 * already been decided by the common one-to-one account. */
export function impactSearchResiduals(events: readonly ContactImpactEvent[], account: ReturnType<typeof accountContactImpacts>,
  match: ReturnType<typeof accountContactImpacts>['matches'][number] | undefined, from: number, to: number) {
  const timing = match ? match.timingError : 0;
  const extra = Math.sqrt(account.unmatchedEvents.reduce((sum, i) => {
    const e = events[i]; return sum + (e.onset >= from && e.onset < to ? (e.raw / CONTACT_IMPACT_CONTRACT.veryStrong) ** 2 : 0);
  }, 0));
  return [timing, extra];
}
/** A sustained gain can evade every short burst band. This search preference
 * uses the same measured per-engagement strongest positive interval exposed
 * in independent review; its weight is not an impact-definition parameter. */
export function engagementGainResiduals(observed: readonly ContactImpactFrame[], from: number, to: number, options: ImpactSearchOptions = {}) {
  return engagementGainResidualsOver(engagementGains(observed, options), from, to, options);
}
/** The engagements those residuals read (none while the preference is off),
 * extracted once for callers that score several windows of one trajectory. */
export function engagementGains(observed: readonly ContactImpactFrame[], options: ImpactSearchOptions = {}) {
  return Math.sqrt(options.engagementGainWeight ?? 0) ? contactSpeedGains(observed) : [];
}
export function engagementGainResidualsOver(gains: ReturnType<typeof contactSpeedGains>, from: number, to: number, options: ImpactSearchOptions = {}) {
  const weight = Math.sqrt(options.engagementGainWeight ?? 0);
  if (!weight) return [];
  let worst = 0;
  for (const e of gains) {
    if (e.end < from || e.start > to) continue;
    const limit = Math.max(.75, .1 * e.strongest.speedBefore);
    worst = Math.max(worst, Math.max(0, e.strongest.gain - limit) / limit);
  }
  return [weight * worst];
}
