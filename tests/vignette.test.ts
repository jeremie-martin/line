import {createRequire} from 'node:module';
import {describe, expect, test} from 'vitest';
import {VignetteLayer} from '../remotion/src/fx.tsx';
import {LOCKED_FX} from '../scripts/fx_recipe.ts';

// Use the renderer's React instance; the root tooling does not depend on React.
const require = createRequire(new URL('../remotion/package.json', import.meta.url));
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

describe('production soft-base vignette', () => {
  test('stays identical during entrance, strong impacts and quiet passages', () => {
    const render = (t: number, enter: number, contacts: {t: number; impactMeasured: number}[]) =>
      renderToStaticMarkup(createElement(VignetteLayer, {fx: LOCKED_FX, t, enter, contacts}));
    const initial = render(0, 0, []);
    expect(initial).not.toBe('');
    expect(render(1, 1, [{t: 1, impactMeasured: 1}])).toBe(initial);
    expect(render(20, .5, [])).toBe(initial);
    expect(initial).toContain('mix-blend-mode:multiply');
    expect(initial).toContain('pointer-events:none');
  });

  test('can still be disabled for clean comparison exports', () => {
    expect(renderToStaticMarkup(createElement(VignetteLayer, {fx: {}, t: 0, enter: 1, contacts: []}))).toBe('');
  });
});
