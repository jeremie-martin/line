import {sha256Hex} from './sha256.js';

/** Fetch the bytes and their identity together. A caller that already checked
 * an optional artifact's HTTP status can pass that response without fetching twice. */
export async function checked(url, signal, digest, response) {
  const content = Promise.resolve(response ?? fetch(url, {signal})).then(async r => {
    if (!r.ok) throw new Error(`Artifact unavailable (${r.status})`);
    const bytes = await r.arrayBuffer();
    return {bytes, actual: await sha256Hex(bytes)};
  });
  const identity = digest || fetch(url + '.sha256', {signal}).then(async r => {
    if (!r.ok) throw new Error('Missing artifact identity');
    return (await r.text()).trim();
  });
  const [{bytes, actual}, expected] = await Promise.all([content, identity]);
  signal?.throwIfAborted();
  if (actual !== expected) throw new Error('Artifact checksum mismatch');
  return JSON.parse(new TextDecoder().decode(bytes));
}
