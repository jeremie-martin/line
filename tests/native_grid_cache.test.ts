import {it, expect} from 'vitest';
import {LineRiderEngine as Native, disposeEngines as dispose} from '../scripts/lib/native_motion/engine.ts';
const core: any = await import('lr-core/line-rider-engine/index.js');
const Reference = typeof core.default === 'function' ? core.default : core.default.default;
const line = core.createLineFromJson ?? core.default.createLineFromJson;

it('matches JS through cached misses, grid edits, sibling switches, resets and detached prefixes', () => {
  const compare = (native: any, reference: any, frame: number, sharedCache = true) => {
    if (sharedCache) expect(native.getLastFrameIndex()).toBe(reference.getLastFrameIndex());
    const actual = native.getStateMapAtFrame(frame), expected = reference.getStateMapAtFrame(frame);
    for (const [id, state] of actual) {
      // The original oracle treats signed zero as the same coordinate.
      expect(JSON.stringify(state.__state__), `${id} at ${frame}`).toBe(JSON.stringify(expected.get(id).__state__));
    }
    const contacts = (e: any) => e.getUpdatesAtFrame(frame).filter((u: any) => u.type === 'CollisionUpdate')
      .map((u: any) => [u.id, u.updated.map((p: any) => p.id)]);
    expect(contacts(native)).toEqual(contacts(reference));
  };
  const floor = {id: 1, type: 0, x1: -50, y1: 10, x2: 400, y2: 10};
  const ramp = {id: 2, type: 1, x1: 0, y1: 4, x2: 300, y2: 30, leftExtended: true, rightExtended: true};
  try {
    const empty = [new Native(), new Reference()].map(e => e.setStart({x: -14, y: -15}, {x: 4, y: 0}));
    compare(empty[0], empty[1], 12);
    const base = [empty[0].addLine(floor), empty[1].addLine(line(floor))];
    compare(base[0], base[1], 50);
    const branch = [base[0].addLine(ramp), base[1].addLine(line(ramp))];
    for (const [native, reference] of [branch, base, empty, branch, base]) compare(native, reference, 60);
    const reset = base.map(e => e.setStart({x: 14, y: -28}, {x: -1, y: 1}));
    compare(reset[0], reset[1], 75);
    compare(base[0], base[1], 60);
    const detached = base[0].detach();
    Native.retainOnly([detached]); // transfers the snapshot after releasing its source
    // Published lr-core has no detached-cache operation; compare its physics,
    // while the paired WASM benchmark checks detached work against the old ABI.
    compare(detached, base[1], 90, false);
    compare(detached.addLine(ramp), base[1].addLine(line(ramp)), 100, false);
  } finally { dispose(); }
});

it('isolates detached snapshots when either live lineage first mutates', () => {
  const floor = {id: 1, type: 0, x1: -50, y1: 10, x2: 800, y2: 10};
  const ramp = {id: 2, type: 1, x1: -50, y1: 8, x2: 800, y2: 8};
  const position = {x: 0, y: -15}, velocity = {x: 4, y: 0};
  const reference = () => new Reference().setStart(position, velocity).addLine(line(floor));
  const compare = (native: any, expected: any, frame: number) => {
    const actual = native.getStateMapAtFrame(frame), states = expected.getStateMapAtFrame(frame);
    for (const [id, state] of actual)
      expect(JSON.stringify(state.__state__), `${id} at ${frame}`).toBe(JSON.stringify(states.get(id).__state__));
  };
  for (const mutation of ['source-grid', 'detached-grid', 'source-start', 'detached-trace']) {
    try {
      const source = new Native().setStart(position, velocity).addLine(floor);
      compare(source, reference(), 60);
      const detached = source.detach();
      let changed: any, unchanged: any, expected: any;
      if (mutation === 'source-grid' || mutation === 'detached-grid') {
        changed = (mutation === 'source-grid' ? source : detached).addLine(ramp);
        unchanged = mutation === 'source-grid' ? detached : source;
        expected = reference().addLine(line(ramp));
      } else if (mutation === 'source-start') {
        const p = {x: 10, y: -25}, v = {x: 2, y: 1};
        changed = source.setStart(p, v); unchanged = detached;
        expected = reference().setStart(p, v);
      } else {
        detached.prepareCollisionTrace(30);
        expect(detached.getLastFrameIndex()).toBe(29);
        changed = detached; unchanged = source; expected = reference();
      }
      expect(unchanged.getLastFrameIndex(), mutation).toBe(60);
      compare(changed, expected, 90);
      expect(unchanged.getLastFrameIndex(), mutation).toBe(60);
      compare(unchanged, reference(), 60);
      if (mutation === 'detached-trace') expect(detached.readCollisionTrace()).toHaveLength(6);
    } finally { dispose(); }
  }
});
