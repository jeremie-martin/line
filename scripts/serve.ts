/** Local review server: static files under the project root (with byte ranges
 * for audio and video) plus the production job API.
 *
 *   npm run serve            # http://127.0.0.1:8767/  →  production review page
 *   HOST=0.0.0.0 PORT=8767 npm run serve
 */
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import {createReadStream, statSync} from 'node:fs';
import {extname, normalize, resolve, sep} from 'node:path';
import {createRepertoireApi} from './gallery/repertoire_api.ts';
import {createLabelsApi} from './gallery/labels_api.ts';

const PORT = Number(process.env.PORT ?? 8767), HOST = process.env.HOST ?? '127.0.0.1';
const ROOT = resolve(process.cwd()), api = createRepertoireApi(), labels = createLabelsApi();
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.opus': 'audio/opus', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.gz': 'application/gzip',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, url: URL) {
  let target = normalize(resolve(ROOT, '.' + decodeURIComponent(url.pathname)));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {res.writeHead(403).end('forbidden'); return;}
  let stat;
  try {
    stat = statSync(target);
    if (stat.isDirectory()) {
      if (!url.pathname.endsWith('/')) {res.writeHead(302, {Location: url.pathname + '/' + url.search}).end(); return;}
      target = resolve(target, 'index.html'); stat = statSync(target);
    }
  } catch {res.writeHead(404).end('not found'); return;}
  const headers = {'Content-Type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes'};
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
  if (range) {
    const start = range[1] === '' ? Math.max(0, stat.size - Number(range[2])) : Number(range[1]);
    const end = range[2] === '' || range[1] === '' ? stat.size - 1 : Math.min(Number(range[2]), stat.size - 1);
    if (!(start <= end && start < stat.size)) {res.writeHead(416, {'Content-Range': `bytes */${stat.size}`}).end(); return;}
    res.writeHead(206, {...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1});
    createReadStream(target, {start, end}).pipe(res);
    return;
  }
  res.writeHead(200, {...headers, 'Content-Length': stat.size});
  if (req.method === 'HEAD') res.end(); else createReadStream(target).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (await api(req, res, url) || await labels(req, res, url)) return;
    if (url.pathname === '/') {res.writeHead(302, {Location: '/motion-gallery/production.html'}).end(); return;}
    serveStatic(req, res, url);
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error: String(e)}));
  }
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {
  api.close(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000).unref();
});
server.listen(PORT, HOST, () => console.log(`review server: http://${HOST}:${PORT}/  (root ${ROOT})`));
