import {describe, expect, it} from 'vitest';
// @ts-ignore browser module
import {playerShortcut} from '../motion-gallery/player-shortcuts.js';
describe('review player shortcuts', () => {
  it('toggles once for Space and suppresses held-key scrolling without toggling again', () => {
    expect(playerShortcut({code: 'Space', key: ' '})).toEqual({type: 'toggle'});
    expect(playerShortcut({code: 'Space', key: ' ', repeat: true})).toEqual({type: 'ignore'});
  });
  it('seeks five seconds, or one second with Shift, including key repeats', () => {
    expect(playerShortcut({key: 'ArrowLeft'})).toEqual({type: 'seek', delta: -5});
    expect(playerShortcut({key: 'ArrowRight', shiftKey: true, repeat: true})).toEqual({type: 'seek', delta: 1});
  });
  it('leaves editing and native interactive controls to the browser', () => {
    expect(playerShortcut({key: ' ', target: {isContentEditable: true}})).toBeUndefined();
    expect(playerShortcut({key: 'ArrowLeft', target: {closest: () => ({})}})).toBeUndefined();
    expect(playerShortcut({key: 'a'})).toBeUndefined();
  });
  it.each(['altKey', 'ctrlKey', 'metaKey', 'isComposing', 'defaultPrevented'])('does not intercept %s', flag => {
    expect(playerShortcut({key: ' ', [flag]: true})).toBeUndefined();
  });
});
