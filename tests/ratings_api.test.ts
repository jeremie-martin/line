import {describe, expect, it} from 'vitest';
import {checkEvent} from '../scripts/gallery/ratings_api.ts';

const ids = new Set(['hokusai', 'plum']);

describe('theme ratings: the events the server keeps', () => {
  it('keeps a grade out of 10, or its clearing', () => {
    expect(checkEvent({kind: 'grade', id: 'plum', grade: 7, extra: 1}, ids)).toEqual({event: {kind: 'grade', id: 'plum', grade: 7}});
    expect(checkEvent({kind: 'grade', id: 'plum', grade: null}, ids)).toEqual({event: {kind: 'grade', id: 'plum', grade: null}});
    for (const grade of [0, 11, 7.5, '7']) expect(checkEvent({kind: 'grade', id: 'plum', grade}, ids)).toHaveProperty('error');
    expect(checkEvent({kind: 'grade', id: 'gold', grade: 5}, ids)).toEqual({error: 'unknown theme'});
  });
  it('keeps a pick between two themes of the set: left, right or equal', () => {
    expect(checkEvent({kind: 'pick', a: 'hokusai', b: 'plum', winner: 'plum'}, ids)).toEqual({event: {kind: 'pick', a: 'hokusai', b: 'plum', winner: 'plum'}});
    expect(checkEvent({kind: 'pick', a: 'hokusai', b: 'plum', winner: null}, ids)).toHaveProperty('event');
    expect(checkEvent({kind: 'pick', a: 'hokusai', b: 'hokusai', winner: null}, ids)).toHaveProperty('error');
    expect(checkEvent({kind: 'pick', a: 'hokusai', b: 'plum', winner: 'gold'}, ids)).toHaveProperty('error');
  });
  it('keeps notes (trimmed to 2000 characters) and undo; refuses anything else', () => {
    expect(checkEvent({kind: 'note', id: 'plum', text: 'x'.repeat(3000)}, ids)).toEqual({event: {kind: 'note', id: 'plum', text: 'x'.repeat(2000)}});
    expect(checkEvent({kind: 'undo'}, ids)).toEqual({event: {kind: 'undo'}});
    expect(checkEvent({kind: 'delete'}, ids)).toEqual({error: 'unknown kind'});
    expect(checkEvent(null, ids)).toEqual({error: 'unknown kind'});
  });
});
