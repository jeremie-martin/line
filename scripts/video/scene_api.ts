/** The review server's scene endpoint: GET /api/scene?ride=PATH&sha256=HEX → the scene (scene.ts) of a saved production
 * record, so the review player draws a ride from exactly the data a video of it would be drawn from. The record's bytes must
 * have the digest its manifest gives. */
import type {IncomingMessage, ServerResponse} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {buildScene, type Scene} from './scene.ts';

export function createSceneApi(root = process.cwd()) {
  const cache = new Map<string, Scene>();
  return async function handle(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
    if (url.pathname !== '/api/scene' || req.method !== 'GET') return false;
    const send = (status: number, body: unknown) => {res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'}); res.end(JSON.stringify(body));};
    const path = resolve(root, '.' + (url.searchParams.get('ride') ?? '')), sha256 = url.searchParams.get('sha256') ?? '';
    if (!path.startsWith(resolve(root) + sep) || !/^[0-9a-f]{64}$/.test(sha256)) {send(400, {error: 'ride=PATH under the project and sha256=HEX required'}); return true;}
    let scene = cache.get(sha256);
    if (!scene) {
      let bytes;
      try {bytes = readFileSync(path);} catch {send(404, {error: 'no such ride'}); return true;}
      if (createHash('sha256').update(bytes).digest('hex') !== sha256) {send(409, {error: 'the ride differs from its manifest'}); return true;}
      const record = JSON.parse(bytes.toString());
      scene = buildScene(record.case.id, record, record.case.audioPath);
      cache.set(sha256, scene); while (cache.size > 8) cache.delete(cache.keys().next().value!);
    }
    send(200, scene); return true;
  };
}
