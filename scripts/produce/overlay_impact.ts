/** Present the saved one-to-one impact account without re-detecting or re-matching hits. */
import {FPS} from '../v0/types.ts';
import type {ImpactEvaluation} from '../v0/optimizer/impact_accounts.ts';

export function overlayImpactContacts(evaluation: Pick<ImpactEvaluation, 'targets' | 'events' | 'account'>) {
  const matches = new Map(evaluation.account.matches.map(match => [match.target, match]));
  return evaluation.targets.map((target, index) => {
    const match = matches.get(index);
    const event = match === undefined ? undefined : evaluation.events[match.event];
    if (match !== undefined && event === undefined) throw new Error('Saved impact match references a missing event');
    return {
      t: target.frame / FPS,
      actualTime: event === undefined ? null : event.onset / FPS,
      landed: event !== undefined,
      impactTarget: target.impact ?? null,
      impactError: match === undefined ? null : Math.abs(match.strengthError),
      impactMeasured: event?.strength ?? null,
      // Strike strength is not the retired contact-redirection raw px/frame value.
      impactRawPxPerFrame: null,
    };
  });
}
