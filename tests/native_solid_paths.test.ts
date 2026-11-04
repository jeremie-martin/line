import {afterEach, expect, it} from 'vitest';
import {LineRiderEngine as Engine, disposeEngines} from '../scripts/lib/native_motion/engine.ts';
import {ADD_LINES_CAP} from '../scripts/lib/native_motion/wasm.ts';
import {solidPathLines} from '../scripts/v0/arc.ts';

afterEach(disposeEngines);

it('registers paths in the same line and chunk order, including empty paths and duplicate ids', () => {
  for (const size of [2, 24, ADD_LINES_CAP + 3]) {
    const paths = [{id: 1, points: []}, {id: 7, points: [{x: 0, y: 0}]},
      {id: 100, points: Array.from({length: size}, (_, i) => ({x: i * 8 - 40, y: 10 + Math.sin(i * .1)}))},
      {id: 105, points: [{x: 40, y: 10}, {x: 80, y: 8}]}, {id: 20000, points: []}];
    const root = new Engine().setStart({x: 0, y: -15}, {x: 8, y: 0});
    root.getRider(20);
    const fromPaths = root.addSolidPaths(paths), fromLines = root.addLine(solidPathLines(paths));
    expect(fromPaths.getLastFrameIndex()).toBe(fromLines.getLastFrameIndex());
    for (const frame of [0, 1, 8, 20, 60]) {
      expect(fromPaths.getRider(frame).ballisticState()).toEqual(fromLines.getRider(frame).ballisticState());
      expect(fromPaths.getUpdatesAtFrame(frame)).toEqual(fromLines.getUpdatesAtFrame(frame));
    }
    expect(root.addSolidPaths([])).toBe(root);
    expect(root.addSolidPaths(paths.slice(0, 2))).toBe(root);
  }
});

it('owns copied coordinates through input mutation and detached reads', () => {
  const paths = [{id: 1, points: [{x: -50, y: 10}, {x: 400, y: 10}]}];
  const root = new Engine().setStart({x: 0, y: -15}, {x: 8, y: 0});
  const pathEngine = root.addSolidPaths(paths).detach(), lineEngine = root.addLine(solidPathLines(paths)).detach();
  paths[0].points[0].y = -1000;
  paths[0].points.length = 0;
  expect(pathEngine.getRider(80).ballisticState()).toEqual(lineEngine.getRider(80).ballisticState());
});
