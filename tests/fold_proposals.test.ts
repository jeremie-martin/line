import {describe, expect, it} from 'vitest';
import {genericControl} from '../scripts/v0/optimizer/arc_proposals.ts';
import {motionArc} from '../scripts/v0/optimizer/arc_geometry.ts';
import type {IntervalSearch} from '../scripts/v0/optimizer/arc_interval_state.ts';

describe('upward fold proposals', () => {
  it('builds two substantial upward corners across incoming headings', () => {
    for (const incoming of [-60, -20, 0, 30, 75]) for (const k of [4, 8, 12, 16]) {
      const options = {profile: 'fold', railLayout: 'paired', independentGuide: true, channel: 12,
        faces: 3, profileStart: 0, profileStrength: 1} as const;
      const control = genericControl({incoming, turn: 20, support: 12, constructionSpan: 24, options} as IntervalSearch, k);
      const lines = motionArc([{x: 0, y: 0}], {x: 8, y: 2}, control, 1000, 12, 24, 4, {...options, guides: false});
      expect(lines).toHaveLength(4);
      const angles = lines.slice(1).map(l => Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * 180 / Math.PI);
      expect(angles[0]).toBeCloseTo(control.entry, 10);
      for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeLessThanOrEqual(-12);
    }
  });
});

it('sizes later upward faces for the speed left after their corners', () => {
  const radians = (a: number) => a * Math.PI / 180;
  const control = {entry: 40, turn: 0, exit: -20, foldBend: 0, support: 12, bias: 0, offset: 0};
  const lines = motionArc([{x: 0, y: 0}], {x: 10, y: 0}, control, 1000, 0, 0, 4,
    {profile: 'fold', profileStart: 0, profileStrength: 1, faces: 3, guides: false});
  let speed = 10 * Math.cos(radians(40));
  for (const [i, heading] of [40, 10, -20].entries()) {
    if (i > 0) speed *= Math.cos(radians(30));
    speed += .175 * Math.sin(radians(heading)) * 4;
    const line = lines[i + 1];
    expect(Math.hypot(line.x2 - line.x1, line.y2 - line.y1)).toBeCloseTo(speed * 4, 10);
    expect(Math.atan2(line.y2 - line.y1, line.x2 - line.x1)).toBeCloseTo(radians(heading), 10);
  }
});
