import {it, expect} from 'vitest';
import {LineRiderEngine as Native, disposeAllWasmEnginesForStudy as dispose} from '../scripts/lib/native_motion/engine.ts';
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
    Native.retainOnly([detached]); // releases the grid whose shortcuts were copied
    // Published lr-core has no detached-cache operation; compare its physics,
    // while the paired WASM benchmark checks detached work against the old ABI.
    compare(detached, base[1], 90, false);
    compare(detached.addLine(ramp), base[1].addLine(line(ramp)), 100, false);
  } finally { dispose(); }
});
