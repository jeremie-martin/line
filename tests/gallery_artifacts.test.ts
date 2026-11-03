import {afterEach, expect, it, vi} from 'vitest';
import {createHash} from 'node:crypto';
// @ts-ignore browser module
import {checked} from '../motion-gallery/artifacts.js';
const text = JSON.stringify({track: 'verified'}), digest = createHash('sha256').update(text).digest('hex');
function deferred<T>() {let resolve!: (value: T) => void; const promise = new Promise<T>(done => {resolve = done;}); return {promise, resolve};}
afterEach(() => vi.unstubAllGlobals());

it('starts artifact and checksum requests before either responds, preserving verification', async () => {
  const body = deferred<Response>(), identity = deferred<Response>();
  const fetch = vi.fn((url: string) => url.endsWith('.sha256') ? identity.promise : body.promise);
  vi.stubGlobal('fetch', fetch);
  const result = checked('/ride.json');
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/ride.json', '/ride.json.sha256']);
  identity.resolve(new Response(digest + '\n'));
  body.resolve(new Response(text));
  expect(await result).toEqual({track: 'verified'});
});

it('uses a known identity and an already fetched optional response without duplicate requests', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(digest));
  vi.stubGlobal('fetch', fetch);
  expect(await checked('/video.json', undefined, undefined, new Response(text))).toEqual({track: 'verified'});
  expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/video.json.sha256']);
  fetch.mockClear();
  expect(await checked('/video.json', undefined, digest, new Response(text))).toEqual({track: 'verified'});
  expect(fetch).not.toHaveBeenCalled();
});

it.each(['bytes', 'identity'])('rejects invalid %s with concurrent requests', async invalid => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(url.endsWith('.sha256')
    ? invalid === 'identity' ? 'wrong' : digest : invalid === 'bytes' ? '{}' : text))));
  await expect(checked('/ride.json')).rejects.toThrow('checksum mismatch');
});

it.each([['body', 'Artifact unavailable'], ['identity', 'Missing artifact identity']])('reports missing %s', async (missing, message) => {
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(url.endsWith('.sha256') ? digest : text,
    {status: (url.endsWith('.sha256') ? 'identity' : 'body') === missing ? 404 : 200}))));
  await expect(checked('/ride.json')).rejects.toThrow(message);
});

it('does not publish a verified artifact after cancellation while identity is pending', async () => {
  const controller = new AbortController(), identity = deferred<Response>();
  vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('.sha256') ? identity.promise : Promise.resolve(new Response(text))));
  const result = checked('/ride.json', controller.signal);
  controller.abort(new Error('superseded'));
  identity.resolve(new Response(digest));
  await expect(result).rejects.toThrow('superseded');
});
