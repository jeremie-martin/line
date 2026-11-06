/** Known-case check of the pass-through detector in analyze.ts (research only).
 *   node tools/measure/geometry_hygiene/validate.ts
 * Builds minimal tracks whose outcome follows from the collision rule and
 * checks that the detector reports exactly that. */
import {analyze} from './analyze.ts';

const line = (id: number, x1: number, y1: number, x2: number, y2: number) =>
  ({id, type: 0, x1, y1, x2, y2, flipped: false, leftExtended: false, rightExtended: false});
const ride = (lines: any[], vy: number, frames = 60) => ({
  track: {startPosition: {x: 0, y: 0}, riders: [{startPosition: {x: 0, y: 0}, startVelocity: {x: 0.4, y: vy}}], lines},
  production: {plan: {requests: [{section: 0, frame: 1, next: frames + 1, construction: 'arcs', guidance: 'required'}]}, railGuides: {0: []}},
  case: {durationFrames: frames}, trace: {frames: Array.from({length: frames + 1}, () => new Array(20).fill(0))},
});
const cases = [
  // A roof (drawn right to left: solid side up) 40 px below the start: the rider falls through it from its solid side.
  {name: 'roof crossed from above (back side)', r: ride([line(1000, 60, 40, -60, 40), line(1001, -200, 400, 400, 400)], 0),
    expect: (a: any) => a.crossings.some((c: any) => c.line === 1000 && c.direction === 'back') && !a.crossings.some((c: any) => c.line === 1000 && c.direction === 'front')},
  // The same segment drawn left to right is a floor: the rider lands on it, no crossing.
  {name: 'floor landed on (no crossing)', r: ride([line(1000, -60, 40, 60, 40)], 0),
    expect: (a: any) => !a.crossings.some((c: any) => c.line === 1000) && a.lines.find((l: any) => l.id === 1000).touched},
  // A floor approached at 45 px/frame: a point can end more than 10 px past it and tunnel.
  {name: 'floor hit at 45 px/frame (front, deep)', r: ride([line(1000, -60, 100, 60, 100)], 45),
    expect: (a: any) => a.crossings.some((c: any) => c.line === 1000 && c.direction === 'front' && c.reason === 'deep')},
];
let ok = true;
for (const c of cases) {
  const a = analyze(c.r);
  const pass = c.expect(a);
  ok &&= pass;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${c.name}: crossings ${JSON.stringify(a.crossings.map((x: any) => [x.frame, x.point, x.line, x.direction, x.reason, +x.depth.toFixed(1)]))} episodes ${a.episodes.length}`);
}
process.exit(ok ? 0 : 1);
