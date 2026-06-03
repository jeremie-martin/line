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
import { createServer, type ServerResponse } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

function json(res: ServerResponse, body: unknown): void {
  const text = JSON.stringify(body, null, 2) + "\n";
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Length", String(Buffer.byteLength(text)));
  res.end(text);
}

/** Read `source.commit` from the top of a golden.json without loading the whole
 *  (multi-MB) file — the source block sits in the first few hundred bytes. */
function headCommit(file: string): string | null {
  let fd: number | null = null;
  try {
    fd = openSync(file, "r");
    const buf = Buffer.alloc(4096);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const match = /"commit":\s*"([0-9a-fA-F]+)"/.exec(buf.toString("utf8", 0, n));
    return match ? match[1] : null;
  } catch {
    return null;
  } finally {
    if (fd !== null) closeSync(fd);
  }
}

const subjectCache = new Map<string, string | null>();
function commitSubject(commit: string | null): string | null {
  if (!commit) return null;
  if (subjectCache.has(commit)) return subjectCache.get(commit) ?? null;
  let subject: string | null = null;
  try {
    subject = execFileSync("git", ["log", "-1", "--format=%s", commit], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
  } catch {
    subject = null;
  }
  subjectCache.set(commit, subject);
  return subject;
}

function listGoldenRuns() {
  const dir = resolve(ROOT, "generated", "golden-runs");
  if (!existsSync(dir)) return [];

  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = resolve(dir, entry.name, "golden.json");
      if (!existsSync(file)) return null;
      const stat = statSync(file);
      const commit = headCommit(file);
      return {
        name: entry.name,
        json: `/generated/golden-runs/${encodeURIComponent(entry.name)}/golden.json`,
        mtime_ms: stat.mtimeMs,
        size_bytes: stat.size,
        commit,
        subject: commitSubject(commit),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.mtime_ms - a.mtime_ms);
}

const server = createServer((req, res) => {
  if (!req.url) { res.statusCode = 400; return res.end("bad request"); }
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/golden-runs") {
    return json(res, { runs: listGoldenRuns() });
  }

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
