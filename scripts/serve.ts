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
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createReadStream, existsSync, readdirSync, statSync, openSync, readSync, closeSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { networkInterfaces } from "node:os";
import { basename, dirname, extname, normalize, relative, resolve, sep } from "node:path";

const PORT = parseInt(process.env.PORT ?? "8767", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const ROOT = resolve(process.cwd());
const MIRROR_ROOT = resolve(ROOT, "mirror");
const MIRROR_PORT = parseInt(process.env.MIRROR_PORT ?? "8765", 10);
const MIRROR_HOST = process.env.MIRROR_HOST ?? "127.0.0.1";
const MIRROR_ORIGIN = process.env.MIRROR_ORIGIN ?? `http://${MIRROR_HOST}:${MIRROR_PORT}`;
const TSX_CLI = resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

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

function json(res: ServerResponse, body: unknown, status = 200): void {
  const text = JSON.stringify(body, null, 2) + "\n";
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Content-Length", String(Buffer.byteLength(text)));
  res.end(text);
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 308;
  res.setHeader("Location", location);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(`redirecting to ${location}\n`);
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

type DashboardJob = {
  id: string;
  kind: "generate";
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
  runName: string;
  specPath: string;
  trackPath: string;
  reportPath: string;
  dashboardUrl: string;
  reportUrl: string;
  logs: string[];
  error?: string;
};

type SpecEntry = {
  name: string;
  label: string;
  path: string;
  group: string;
};

const jobs = new Map<string, DashboardJob>();
let mirrorServerReady: Promise<void> | null = null;

function listV0Specs(): SpecEntry[] {
  const groups = [
    { group: "v0", dir: resolve(ROOT, "scripts", "v0", "specs") },
    { group: "golden", dir: resolve(ROOT, "specs", "golden") },
  ];

  const specs: SpecEntry[] = [];
  for (const { group, dir } of groups) {
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.startsWith("_")) continue;
      const abs = resolve(dir, entry.name);
      const rel = toPosixPath(relative(ROOT, abs));
      const name = entry.name.replace(/\.ts$/, "");
      specs.push({ name, label: `${group}/${name}`, path: rel, group });
    }
  }
  return specs.sort((a, b) => a.label.localeCompare(b.label));
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function isUnder(root: string, path: string): boolean {
  return path === root || path.startsWith(root + sep);
}

function workspaceUrl(filePath: string): string {
  return "/" + toPosixPath(relative(ROOT, filePath));
}

function appendLog(job: DashboardJob, line: string): void {
  job.logs.push(line);
  if (job.logs.length > 1000) job.logs.splice(0, job.logs.length - 1000);
  job.updatedAt = new Date().toISOString();
}

function appendOutput(job: DashboardJob, chunk: Buffer): void {
  const text = chunk.toString("utf8").replace(/\r/g, "\n");
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (line) appendLog(job, line);
  }
}

function snapshotJob(job: DashboardJob) {
  return {
    id: job.id,
    kind: job.kind,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    runName: job.runName,
    specPath: job.specPath,
    trackPath: job.trackPath,
    reportPath: job.reportPath,
    dashboardUrl: job.dashboardUrl,
    reportUrl: job.reportUrl,
    logs: job.logs,
    error: job.error,
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 64 * 1024) throw new Error("request body too large");
    chunks.push(buf);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  return text ? JSON.parse(text) : {};
}

function valueAsString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" ? value : null;
}

function valueAsNumber(body: Record<string, unknown>, key: string, fallback: number): number {
  const value = body[key];
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function valueAsBool(body: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = body[key];
  return typeof value === "boolean" ? value : fallback;
}

function impactLabelsPath(name: string): string {
  return resolve(ROOT, "generated", "impact-study", `${name}.labels.json`);
}
function readImpactLabels(name: string): Record<string, unknown> {
  const file = impactLabelsPath(name);
  if (!existsSync(file)) return {};
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    // typeof null === "object" — guard the null and array cases so callers that
    // index the result (labels[frame] = ...) never hit a TypeError on a null map.
    return parsed && parsed.labels && typeof parsed.labels === "object" && !Array.isArray(parsed.labels)
      ? parsed.labels
      : {};
  } catch {
    return {};
  }
}
function writeImpactLabels(name: string, labels: Record<string, unknown>): void {
  const file = impactLabelsPath(name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ name, updatedAt: new Date().toISOString(), labels }, null, 2) + "\n");
}

function compactTimestamp(): string {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14);
}

function cleanRunName(raw: string): string {
  return raw
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function runNameInUse(name: string): boolean {
  const outPrefix = resolve(ROOT, "generated", "dashboard", name);
  const activeJob = [...jobs.values()].some((job) =>
    job.runName === name && (job.status === "queued" || job.status === "running")
  );
  return activeJob ||
    existsSync(resolve(ROOT, "shakedown", name)) ||
    existsSync(`${outPrefix}.track.json`) ||
    existsSync(`${outPrefix}.report.json`);
}

function uniqueRunName(base: string): string {
  let candidate = base;
  for (let i = 2; runNameInUse(candidate); i++) {
    candidate = `${base}_${i}`;
  }
  return candidate;
}

function startGenerateJob(body: Record<string, unknown>): DashboardJob {
  const specs = listV0Specs();
  const allowed = new Map(specs.map((s) => [resolve(ROOT, s.path), s.path]));
  const rawSpec = valueAsString(body, "spec") ?? "";
  const specAbs = normalize(resolve(ROOT, rawSpec));
  const specPath = allowed.get(specAbs);
  if (!specPath) throw new Error(`unsupported spec path: ${rawSpec}`);

  const seed = Math.trunc(valueAsNumber(body, "seed", 0));
  const budget = Math.trunc(valueAsNumber(body, "budget", 200_000));
  if (!Number.isSafeInteger(seed)) throw new Error("seed must be an integer");
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("budget must be a positive integer");

  const rawRunName = valueAsString(body, "runName");
  const baseName = cleanRunName(rawRunName ?? "");
  const specName = basename(specPath).replace(/\.ts$/, "");
  const runName = uniqueRunName(baseName || cleanRunName(`${specName}_${compactTimestamp()}`));
  if (!runName) throw new Error("run name is empty after sanitizing");

  const outPrefix = resolve(ROOT, "generated", "dashboard", runName);
  const trackPath = `${outPrefix}.track.json`;
  const reportPath = `${outPrefix}.report.json`;
  const dashboardUrl = `/dashboard/?run=${encodeURIComponent(runName)}`;
  const reportUrl = `/dashboard/?report=${encodeURIComponent(workspaceUrl(reportPath))}`;

  const now = new Date().toISOString();
  const job: DashboardJob = {
    id: randomUUID().slice(0, 8),
    kind: "generate",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    runName,
    specPath,
    trackPath: workspaceUrl(trackPath),
    reportPath: workspaceUrl(reportPath),
    dashboardUrl,
    reportUrl,
    logs: [],
  };

  jobs.set(job.id, job);
  void runGenerateJob(job, {
    seed,
    budget,
    render: valueAsBool(body, "render", true),
    resolution: valueAsString(body, "resolution") === "1080p" ? "1080p" : "720p",
    hq: valueAsBool(body, "hq", false),
    zoom: valueAsNumber(body, "zoom", 3),
  });

  return job;
}

async function runGenerateJob(
  job: DashboardJob,
  opts: { seed: number; budget: number; render: boolean; resolution: "720p" | "1080p"; hq: boolean; zoom: number },
): Promise<void> {
  job.status = "running";
  appendLog(job, `run=${job.runName}`);
  appendLog(job, `spec=${job.specPath}`);

  try {
    const outPrefix = toPosixPath(relative(ROOT, resolve(ROOT, "generated", "dashboard", job.runName)));
    await runTsx(job, [
      "scripts/v0/run.ts",
      `--spec=${job.specPath}`,
      "--compiler=handoff",
      `--seed=${opts.seed}`,
      `--budget=${opts.budget}`,
      `--out=${outPrefix}`,
    ]);

    const inspectArgs = [
      "scripts/inspect.ts",
      `--track=${outPrefix}.track.json`,
      `--name=${job.runName}`,
      `--out=${toPosixPath(relative(ROOT, resolve(ROOT, "shakedown", job.runName)))}`,
      `--zoom=${opts.zoom}`,
    ];
    if (opts.render) {
      appendLog(job, `mirror=${await ensureMirrorOrigin(job)}`);
      inspectArgs.push("--render");
      if (opts.resolution === "1080p") inspectArgs.push("--1080p");
      if (opts.hq) inspectArgs.push("--hq");
    } else {
      inspectArgs.push("--no-render");
    }
    await runTsx(job, inspectArgs);

    job.status = "succeeded";
    appendLog(job, `done: ${job.dashboardUrl}`);
  } catch (e) {
    job.status = "failed";
    job.error = String(e);
    appendLog(job, `ERROR: ${String(e)}`);
  } finally {
    job.updatedAt = new Date().toISOString();
  }
}

async function runTsx(job: DashboardJob, args: string[]): Promise<void> {
  if (!existsSync(TSX_CLI)) throw new Error(`tsx CLI not found at ${TSX_CLI}`);
  appendLog(job, `$ npx tsx ${args.join(" ")}`);
  await new Promise<void>((resolveOk, reject) => {
    const child = spawn(process.execPath, [TSX_CLI, ...args], {
      cwd: ROOT,
      // Enlarge V8 young-gen for the spawned compile (scavenge-heavy workload →
      // ~6-8% faster, output unaffected). This path goes through the tsx CLI's
      // child, so NODE_OPTIONS (inherited by that child) is the reliable carrier.
      env: {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, "--max-semi-space-size=64"]
          .filter(Boolean)
          .join(" "),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk: Buffer) => appendOutput(job, chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput(job, chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolveOk();
      else reject(new Error(`command exited with ${code}`));
    });
  });
}

async function mirrorReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MIRROR_ORIGIN}/index.html`, { signal: AbortSignal.timeout(1200) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureMirrorOrigin(job: DashboardJob): Promise<string> {
  if (await mirrorReachable()) return MIRROR_ORIGIN;
  if (!mirrorServerReady) {
    mirrorServerReady = new Promise<void>((resolveReady, reject) => {
      const mirror = createServer((req, res) => serveStatic(req, res, MIRROR_ROOT));
      mirror.on("error", reject);
      mirror.listen(MIRROR_PORT, MIRROR_HOST, () => {
        appendLog(job, `started mirror ${MIRROR_ROOT} -> ${MIRROR_ORIGIN}`);
        resolveReady();
      });
    });
  }
  await mirrorServerReady;
  return MIRROR_ORIGIN;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!req.url) {
    res.statusCode = 400;
    res.end("bad request");
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/api/golden-runs") {
    return json(res, { runs: listGoldenRuns() });
  }
  if (url.pathname === "/api/specs") {
    return json(res, { specs: listV0Specs() });
  }
  if (url.pathname === "/api/jobs/generate" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json(res, { error: "expected JSON object" }, 400);
      }
      const job = startGenerateJob(body as Record<string, unknown>);
      return json(res, { job: snapshotJob(job) }, 202);
    } catch (e) {
      return json(res, { error: String(e) }, 400);
    }
  }
  const jobMatch = /^\/api\/jobs\/([^/]+)$/.exec(url.pathname);
  if (jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return json(res, { error: "job not found" }, 404);
    return json(res, { job: snapshotJob(job) });
  }

  // ── impact-study felt-label annotations (per-track JSON the dashboard writes
  //    and study_impact_labels.ts --labels reads). Keyed by landing frame. ──────
  if (url.pathname === "/api/impact-labels") {
    if (req.method === "GET") {
      const name = cleanRunName(url.searchParams.get("name") ?? "");
      if (!name) return json(res, { error: "missing name" }, 400);
      return json(res, { name, labels: readImpactLabels(name) });
    }
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
        const b = body as Record<string, unknown>;
        const name = cleanRunName(valueAsString(b, "name") ?? "");
        if (!name) return json(res, { error: "missing name" }, 400);
        const frame = Math.trunc(valueAsNumber(b, "frame", NaN));
        if (!Number.isSafeInteger(frame)) return json(res, { error: "frame must be an integer" }, 400);
        const labels = readImpactLabels(name);
        const annotation = b.annotation;
        if (annotation == null || (typeof annotation === "object" && Object.keys(annotation as object).length === 0)) {
          delete labels[String(frame)];
        } else {
          labels[String(frame)] = annotation;
        }
        writeImpactLabels(name, labels);
        return json(res, { ok: true, name, count: Object.keys(labels).length });
      } catch (e) {
        return json(res, { error: String(e) }, 400);
      }
    }
    return json(res, { error: "method not allowed" }, 405);
  }

  if (url.pathname === "/") {
    return redirect(res, `/dashboard/${url.search}`);
  }

  serveStatic(req, res, ROOT);
}

function serveStatic(req: IncomingMessage, res: ServerResponse, root: string): void {
  // Resolve under the supplied root; reject any traversal.
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const reqPath = decodeURIComponent(url.pathname);
  const absPath = normalize(resolve(root, "." + reqPath));
  if (!isUnder(root, absPath)) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }

  let stat;
  let target = absPath;
  try {
    stat = statSync(target);
    if (stat.isDirectory()) {
      if (!url.pathname.endsWith("/")) {
        redirect(res, `${url.pathname}/${url.search}`);
        return;
      }
      target = resolve(target, "index.html");
      stat = statSync(target);
    }
  } catch {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  const size = stat.size;
  const mime = MIME[extname(target).toLowerCase()] ?? "application/octet-stream";
  const lastModified = stat.mtime.toUTCString();
  const cacheControl = "no-store";

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] === "" ? Math.max(0, size - parseInt(m[2], 10)) : parseInt(m[1], 10);
      const end   = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${size}`);
        res.end();
        return;
      }
      res.statusCode = 206;
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", cacheControl);
      res.setHeader("Last-Modified", lastModified);
      res.setHeader("X-File-MTime-Ms", String(stat.mtimeMs));
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      res.setHeader("Content-Length", String(end - start + 1));
      createReadStream(target, { start, end }).pipe(res);
      return;
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", cacheControl);
  res.setHeader("Last-Modified", lastModified);
  res.setHeader("X-File-MTime-Ms", String(stat.mtimeMs));
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Length", String(size));
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}

const server = createServer((req, res) => {
  handleRequest(req, res).catch((e) => {
    if (!res.headersSent) return json(res, { error: String(e) }, 500);
    res.end();
  });
});

function accessHosts(host: string): string[] {
  if (host !== "0.0.0.0" && host !== "::") return [host];

  const hosts = new Set<string>(["127.0.0.1"]);
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) hosts.add(entry.address);
    }
  }
  return [...hosts];
}

server.listen(PORT, HOST, () => {
  console.log(`serving ${ROOT} on ${HOST}:${PORT}`);
  for (const host of accessHosts(HOST)) {
    console.log(`Dashboard: http://${host}:${PORT}/dashboard/`);
  }
});
