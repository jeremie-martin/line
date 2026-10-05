/** Cold measurement of a saved track. Shared by compilation and remeasurement. */
import {replayGalleryTrack} from '../../scripts/gallery/artifacts.ts';
import {observe} from '../measure/observe.ts';
import {beatRows} from '../measure/measures.ts';
import {arrivalPose} from '../measure/arrival.ts';
import {strikeFrames, strikeMotionFrames, detectStrikes, accountStrikes, STRIKE_V2_CONTRACT, STRIKE_V3_CONTRACT} from '../measure/strike.ts';
export function measureCell({c, mode, track, spec, music, physicalFrames, compileMs, complete, fulfilled, motion}: any) {
  const frozen = replayGalleryTrack(track, music, false).grade;
  const targets = music.contacts, observation = observe(track, music.durationFrames, targets);
  const strikes = detectStrikes(strikeFrames(observation)).filter(e => e.onset <= music.durationFrames);
  const strike = accountStrikes(strikes, targets);
  // Every run is also scored under v2 (whole-body motion change), whatever it optimized.
  const motionFrames = strikeMotionFrames(observation);
  const impacts = detectStrikes(motionFrames, STRIKE_V2_CONTRACT).filter(e => e.onset <= music.durationFrames);
  const impact = accountStrikes(impacts, targets, STRIKE_V2_CONTRACT);
  // ...and under v3, where a floor-then-rail double contact is two impacts.
  const reversals: Array<{before: number; after: number; beforeStrength: number; afterStrength: number}> = [];
  const impacts3 = detectStrikes(motionFrames, STRIKE_V3_CONTRACT, (a, b) => {
    if (b.onset <= music.durationFrames) reversals.push({before: a.contactStart, after: b.contactStart, beforeStrength: a.strength, afterStrength: b.strength});
  }).filter(e => e.onset <= music.durationFrames);
  const impact3 = accountStrikes(impacts3, targets, STRIKE_V3_CONTRACT);
  // Guards from the blind-spot audit (docs/research/scorecard-blind-spots-20261005.md).
  const BODY = [4, 5, 6, 7];
  const vel = (f: number) => {let x = 0, y = 0; for (const [a,b,c,d] of observation.frames[f].points) {x += a-c; y += b-d;} return [x/10,y/10];};
  const perBeat = targets.map((t: any, j: number) => {
    const m = impact3.matches.find((m: any) => m.target === j), e = m ? impacts3[m.event] : undefined;
    return {requested: t.impact ?? null, hit: e ? {strength: +e.strength.toFixed(4), onset: e.onset,
      offset: e.onset - t.frame, peakFrame: e.peakFrame, ...arrivalPose(observation.frames, e.contactStart)} : null};
  });
  const strongPose = perBeat.filter((b: any) => b.requested >= .6 && b.hit).map((b: any) => b.hit.headDown);
  const last = Math.min(music.durationFrames, observation.frames.length - 1);
  let dragFrames = 0, run = 0, kicks = 0;
  for (let f = 1; f <= last; f++) {
    const body = observation.frames[f].collisions.some((x: number[]) => BODY.includes(x[1]));
    run = body ? run + 1 : 0; if (run === 6) dragFrames += 6; else if (run > 6) dragFrames++;
    const [px, py] = vel(f - 1), before = Math.hypot(px, py + .175), gain = Math.hypot(...vel(f)) - before;
    if (gain > Math.max(.75, .1 * before) && !targets.some((t: any) => Math.abs(t.frame - f) <= 4)) kicks++;
  }
  const guards = {strongInverted: strongPose.length ? strongPose.filter(Boolean).length / strongPose.length : NaN,
    dragSecondsPerMinute: dragFrames / 40 / (last / 40 / 60), offBeatKicks: kicks};
  const strongExtras = (account: any, events: any[]) => account.unmatchedEvents.filter((i: number) => events[i].strength >= .25).length;
  const beats = beatRows({id: c.id, set: mode, song: c.song, seed: c.seed, durationFrames: music.durationFrames,
    targets: spec.contacts.map((x: any) => ({t: x.t, frame: Math.round(x.t * 40), impact: x.impact})), ...observation});
  return {case: c, mode,
    physicalFrames, compileMs, complete, fulfilled,
    frozen: {valid: frozen.score.valid, score: frozen.score.score, axes: frozen.score.components},
    // Per gap and axis (air, speed, amplitude): [gap, axis, target, achieved], signed errors recoverable.
    gaps: frozen.observations.filter((o: any) => o.axis !== 'impact').map((o: any) => [o.gap, o.axis, +o.target.toFixed(4), o.achieved === null ? null : +o.achieved.toFixed(4)]),
    contact: {loss: observation.contactAccount.loss, strengthMse: observation.contactAccount.strengthMse, timingMse: observation.contactAccount.timingMse, extraMse: observation.contactAccount.extraMse},
    strike: {loss: strike.loss, strengthMse: strike.strengthMse, timingMse: strike.timingMse, extraMse: strike.extraMse, missing: strike.missingTargets.length},
    impact: {loss: impact.loss, strengthMse: impact.strengthMse, timingMse: impact.timingMse, extraMse: impact.extraMse, missing: impact.missingTargets.length,
      strongExtras: strongExtras(impact, impacts), beats: targets.length},
    impact3: {loss: impact3.loss, strengthMse: impact3.strengthMse, extraMse: impact3.extraMse, strongExtras: strongExtras(impact3, impacts3),
      reversals, beats: targets.length, perBeat},
    motion, guards, beats};
}
