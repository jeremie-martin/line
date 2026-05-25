/**
 * Tiny static file server with byte-range support.
 *
 * Python's `http.server` ignores `Range` and returns 200 + full file, which
 * prevents the dashboard's `<video>` from seeking. This minimal Node server
 * is range-aware (Accept-Ranges: bytes + 206 Partial Content) so scrubbing
 * works in Chromium / Firefox.
 *
 * Usage:
 *   npx tsx scripts/serve.ts                      # serves project root on 127.0.0.1:8767
 *   PORT=9000 npx tsx scripts/serve.ts            # custom port
 *   HOST=0.0.0.0 npx tsx scripts/serve.ts         # bind to all interfaces (LAN access)
 */
import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { resolve, extname, normalize, sep } from "node:path";

const PORT = parseInt(process.env.PORT ?? "8767", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const ROOT = resolve(process.cwd());

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".txt":  "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  if (!req.url) { res.statusCode = 400; return res.end("bad request"); }
  const url = new URL(req.url, `http://${req.headers.host}`);
  // Resolve under ROOT; reject any traversal.
  const reqPath = decodeURIComponent(url.pathname);
  const absPath = normalize(resolve(ROOT, "." + reqPath));
  if (!absPath.startsWith(ROOT + sep) && absPath !== ROOT) {
    res.statusCode = 403;
    return res.end("forbidden");
  }

  let stat;
  let target = absPath;
  try {
    stat = statSync(target);
    if (stat.isDirectory()) {
      target = resolve(target, "index.html");
      stat = statSync(target);
    }
  } catch {
    res.statusCode = 404;
    return res.end("not found");
  }

  const size = stat.size;
  const mime = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] === "" ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
      const end   = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.end();
      }
      res.statusCode = 206;
      res.setHeader("Content-Type", mime);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      createReadStream(target, { start, end }).pipe(res);
      return;
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", String(size));
  if (req.method === "HEAD") return res.end();
  createReadStream(target).pipe(res);
});

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT}  →  http://${HOST}:${PORT}/`);
  console.log(`Dashboard: http://${HOST}:${PORT}/dashboard/`);
});
