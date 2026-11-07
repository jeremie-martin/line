import {readFileSync} from 'node:fs';
import {expect, it, vi} from 'vitest';
import {LineRiderEngine} from '../scripts/lib/native_motion/engine.ts';
import {prepareCell} from '../tools/parity/parity.ts';
import {cellIndices} from '../tools/measure/engine_decision.ts';

it('fails a compile that simulates physics it did not charge', async () => {
  const {cells} = JSON.parse(readFileSync('tools/parity/cells.json', 'utf8'));
  const {compile} = await prepareCell(cellIndices(cells, ['canonical-music_luna_bala_44s-automatic#101@150000'])[0]);
  // Metered reads charge whatever a cache grows by, so leak outside them: once, adding
  // lines also simulates 40 frames on the new engine. Nothing charges that.
  const add = LineRiderEngine.prototype.addLine;
  let leaked = false;
  vi.spyOn(LineRiderEngine.prototype, 'addLine').mockImplementation(function (this: LineRiderEngine, line) {
    const engine = add.call(this, line);
    if (!leaked) {leaked = true; engine.advanceWhileBound(engine.getLastFrameIndex() + 40);}
    return engine;
  });
  expect(() => compile()).toThrow(/simulated \d+ frames it did not charge/);
  expect(leaked).toBe(true);
}, 60_000);
