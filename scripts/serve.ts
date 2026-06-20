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
import { createReadStream, existsSync, readdirSync, statSync, openSync, readSync, closeSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { availableParallelism, networkInterfaces } from "node:os";
import { basename, dirname, extname, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { specZoomLaneToRenderPlan } from "./v0/core/camera.ts";
import { AXES, FPS, type AxisName, type Spec, type SpecMusic } from "./v0/types.ts";
import {
  applySpecDashboardEdit,
  editableMeta,
  readSpecDashboardSourceIndex,
  type ApplySpecDashboardEditInput,
  type SpecDashboardEditMeta,
  type SpecDashboardSourceEntry,
  type SpecDashboardSourceIndex,
} from "./spec_dashboard_source.ts";
import {
  calibrationSelectionPath,
  readCalibrationSelection,
  type CalibrationSelection,
  type SpecCalibration,
} from "./v0/core/spec_modifiers.ts";

const PORT = parseInt(process.env.PORT ?? "8767", 10);
const HOST = process.env.HOST ?? "127.0.0.1";
const ROOT = resolve(process.cwd());
const MIRROR_ROOT = resolve(ROOT, "mirror");
const MIRROR_PORT = parseInt(process.env.MIRROR_PORT ?? "8765", 10);
const MIRROR_HOST = process.env.MIRROR_HOST ?? "127.0.0.1";
const MIRROR_ORIGIN = process.env.MIRROR_ORIGIN ?? `http://${MIRROR_HOST}:${MIRROR_PORT}`;
const TSX_CLI = resolve(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const SPEC_HISTORY_LIMIT = 80;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".opus": "audio/opus",
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
  kind: "generate" | "calibrate";
  status: "queued" | "running" | "succeeded" | "failed";
  createdAt: string;
  updatedAt: string;
  runName: string;
  specPath: string;
  trackPath: string | null;
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

type ResolvedSpecEntry = {
  entry: SpecEntry;
  absPath: string;
};

type SpecNote = {
  id: string;
  t: number;
  scope: "moment" | "contact" | "gap" | "range" | "keyframe";
  index: number | null;
  t0?: number | null;
  t1?: number | null;
  axis?: string | null;
  title: string;
  text: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type SpecEdit = {
  id: string;
  target: "moment" | "contact" | "gap" | "range" | "keyframe";
  t: number;
  index: number | null;
  t0?: number | null;
  t1?: number | null;
  axis?: string | null;
  value?: number | null;
  ease?: string | null;
  impact?: number | null;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type FileSnapshot = {
  path: string;
  existed: boolean;
  contents: string | null;
};

type SpecHistoryEntry = {
  id: string;
  specPath: string;
  label: string;
  createdAt: string;
  before: FileSnapshot[];
  after: FileSnapshot[];
};

type SpecHistoryState = {
  undo: SpecHistoryEntry[];
  redo: SpecHistoryEntry[];
};

type DashboardCameraZoom = {
  points: [number, number][];
  keyframes: {
    id: string;
    index: number;
    t: number;
    zoom: number;
    edit: SpecDashboardEditMeta;
  }[];
  renderKeyframes: {
    i: number;
    frame: number;
    t: number;
    zoom: number;
    log2Zoom: number;
  }[];
  smoothingFrames: number;
  min: number;
  max: number;
  count: number;
};

type DashboardCamera = {
  zoom?: DashboardCameraZoom;
};

const jobs = new Map<string, DashboardJob>();
const specHistory = new Map<string, SpecHistoryState>();
let mirrorServerReady: Promise<void> | null = null;

const SPEC_GROUP_DIRS = [
  { group: "v0", dir: resolve(ROOT, "scripts", "v0", "specs") },
  { group: "golden", dir: resolve(ROOT, "specs", "golden") },
  { group: "production", dir: resolve(ROOT, "productions") },
];
let specListCache: { key: string; specs: SpecEntry[] } | null = null;

function listV0Specs(): SpecEntry[] {
  // Cache keyed by the corpus dirs' mtimes. Every spec API call resolves through here and
  // the dashboard fires several per interaction; without the cache each one re-readdirs +
  // existsSyncs the whole corpus. A cache hit costs a handful of statSync instead. The key
  // folds in each production subdir's mtime too, because production specs live one level
  // deeper (productions/<name>/spec.ts) and the parent dir's mtime does NOT change when a
  // spec.ts is added/removed inside an already-existing subdir.
  const key = specListCacheKey();
  if (specListCache && specListCache.key === key) return specListCache.specs;

  const specs: SpecEntry[] = [];
  for (const { group, dir } of SPEC_GROUP_DIRS) {
    if (!existsSync(dir)) continue;

    if (group === "production") {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const specName = entry.name;
        const specAbs = resolve(dir, specName, "spec.ts");
        if (!existsSync(specAbs)) continue;
        const rel = toPosixPath(relative(ROOT, specAbs));
        specs.push({
          name: specName,
          label: `${group}/${specName}`,
          path: rel,
          group,
        });
      }
      continue;
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.startsWith("_")) continue;
      const abs = resolve(dir, entry.name);
      const rel = toPosixPath(relative(ROOT, abs));
      const name = entry.name.replace(/\.ts$/, "");
      specs.push({ name, label: `${group}/${name}`, path: rel, group });
    }
  }
  specs.sort((a, b) => a.label.localeCompare(b.label));
  specListCache = { key, specs };
  return specs;
}

/** Freshness key for listV0Specs: each group dir's mtime, plus each production subdir's
 *  mtime (nested spec.ts add/remove only bumps the subdir, not productions/). */
function specListCacheKey(): string {
  const parts: string[] = [];
  for (const { group, dir } of SPEC_GROUP_DIRS) {
    if (!existsSync(dir)) { parts.push("-"); continue; }
    parts.push(String(Math.trunc(statSync(dir).mtimeMs)));
    if (group === "production") {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) parts.push(`${entry.name}=${Math.trunc(statSync(resolve(dir, entry.name)).mtimeMs)}`);
      }
    }
  }
  return parts.join("|");
}

function resolveListedSpec(rawSpec: string): ResolvedSpecEntry | null {
  const specAbs = normalize(resolve(ROOT, rawSpec));
  for (const entry of listV0Specs()) {
    const absPath = normalize(resolve(ROOT, entry.path));
    if (absPath === specAbs) return { entry, absPath };
  }
  return null;
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

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function jsonClone(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function valueAsOptionalNumber(body: Record<string, unknown>, key: string, fallback: number | null = null): number | null {
  const value = body[key];
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function resolveAssetRef(ref: string, baseDir = ROOT): { url: string; absPath: string | null } {
  const trimmed = ref.trim();
  if (/^(https?:)?\/\//.test(trimmed) || /^(data|blob):/.test(trimmed)) {
    return { url: trimmed, absPath: null };
  }
  if (trimmed.startsWith("/")) {
    const absPath = normalize(resolve(ROOT, "." + trimmed));
    return isUnder(ROOT, absPath) ? { url: trimmed, absPath } : { url: trimmed, absPath: null };
  }
  const absPath = normalize(resolve(baseDir, trimmed));
  if (!isUnder(ROOT, absPath)) return { url: trimmed, absPath: null };
  return { url: workspaceUrl(absPath), absPath };
}

function normalizeCurveMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const raw = meta as Record<string, unknown>;
  const points = Array.isArray(raw.points)
    ? raw.points
        .map((point, index) => {
          if (!point || typeof point !== "object" || Array.isArray(point)) return null;
          const p = point as Record<string, unknown>;
          const t = valueAsOptionalNumber(p, "t");
          const v = valueAsOptionalNumber(p, "v");
          if (t === null || v === null) return null;
          const sourceIndex = valueAsOptionalNumber(p, "sourceIndex");
          return {
            i: Number.isSafeInteger(sourceIndex) ? sourceIndex : index,
            t: round(t, 4),
            v: round(v, 4),
            ease: typeof p.ease === "string" ? p.ease : null,
          };
        })
        .filter((point): point is { i: number; t: number; v: number; ease: string | null } => point !== null)
    : [];
  if (points.length === 0) return null;
  return {
    kind: typeof raw.kind === "string" ? raw.kind : "unknown",
    defaultEase: typeof raw.defaultEase === "string" ? raw.defaultEase : null,
    points,
  };
}

function readJsonAsset(absPath: string | null): unknown {
  if (!absPath || !existsSync(absPath)) return null;
  try {
    return JSON.parse(readFileSync(absPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeSpecMusic(music: SpecMusic | undefined): Record<string, unknown> | null {
  if (!music || typeof music.audio !== "string" || !music.audio.trim()) return null;

  const audio = resolveAssetRef(music.audio);
  const beats = music.beats ? resolveAssetRef(music.beats) : null;
  const metaRef = music.spectrogram?.metadata ? resolveAssetRef(music.spectrogram.metadata) : null;
  const spectrogramMeta = metaRef ? readJsonAsset(metaRef.absPath) : null;
  const metaImage = spectrogramMeta && typeof spectrogramMeta === "object" && !Array.isArray(spectrogramMeta)
    ? (spectrogramMeta as Record<string, unknown>).image
    : null;
  const image = music.spectrogram?.image
    ? resolveAssetRef(music.spectrogram.image)
    : typeof metaImage === "string" && metaRef?.absPath
      ? resolveAssetRef(metaImage, dirname(metaRef.absPath))
      : null;

  return {
    title: music.title ?? null,
    artist: music.artist ?? null,
    tempo: music.tempo ?? null,
    offset: Number.isFinite(music.offset) ? music.offset : 0,
    audio: music.audio,
    audioUrl: audio.url,
    beats: music.beats ?? null,
    beatsUrl: beats?.url ?? null,
    spectrogram: image || metaRef || spectrogramMeta
      ? {
          image: music.spectrogram?.image ?? null,
          imageUrl: image?.url ?? null,
          metadata: music.spectrogram?.metadata ?? null,
          metadataUrl: metaRef?.url ?? null,
          meta: spectrogramMeta,
        }
      : null,
  };
}

function isSpecCalibration(value: unknown): value is SpecCalibration {
  return Boolean(value && typeof value === "object" && Array.isArray((value as SpecCalibration).candidates));
}

function normalizeCalibrationCandidate(candidate: unknown): Record<string, unknown> | null {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const raw = candidate as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.label !== "string") return null;
  return {
    id: raw.id,
    label: raw.label,
    description: typeof raw.description === "string" ? raw.description : null,
  };
}

function calibrationInfo(
  mod: Record<string, unknown>,
  specAbsPath: string,
  specPath: string,
): Record<string, unknown> {
  const selectionPath = calibrationSelectionPath(specAbsPath);
  const selection = readCalibrationSelection(selectionPath);
  const calibration = isSpecCalibration(mod.calibration) ? mod.calibration : null;
  const candidates = calibration === null
    ? []
    : calibration.candidates.map(normalizeCalibrationCandidate).filter((c): c is Record<string, unknown> => c !== null);
  const latest = latestCalibrationReport(specPath);
  return {
    available: calibration !== null,
    hasBaseSpec: mod.baseSpec !== undefined,
    candidates,
    objective: calibration?.objective ?? null,
    selection,
    selected: selection?.enabled ? selection.selected : "identity",
    enabled: selection?.enabled === true,
    selectionPath: workspaceUrl(selectionPath),
    latestReport: latest,
  };
}

function latestCalibrationReport(specPath: string): Record<string, unknown> | null {
  const root = resolve(ROOT, "generated", "spec-calibration");
  if (!existsSync(root)) return null;
  let best: { path: string; mtimeMs: number; json: Record<string, unknown> } | null = null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = resolve(root, entry.name, "calibration.json");
    if (!existsSync(file)) continue;
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const spec = parsed.spec;
      const path = spec && typeof spec === "object" && !Array.isArray(spec)
        ? (spec as Record<string, unknown>).path
        : null;
      if (path !== specPath) continue;
      const stat = statSync(file);
      if (best === null || stat.mtimeMs > best.mtimeMs) {
        best = { path: file, mtimeMs: stat.mtimeMs, json: parsed };
      }
    } catch {
      // Ignore malformed or partial reports while a job is still writing.
    }
  }
  if (best === null) return null;
  return {
    path: workspaceUrl(best.path),
    mtime_ms: best.mtimeMs,
    report: best.json,
  };
}

function axisValue(spec: Spec, axis: AxisName, t: number): number | null {
  const curve = spec.axes?.[axis];
  if (typeof curve !== "function") return null;
  const value = curve(t);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sampleAxesAt(spec: Spec, t: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const axis of AXES) {
    const value = axisValue(spec, axis, t);
    if (value !== null) out[axis] = round(value, 4);
  }
  return out;
}

function matchingEditMetaFor(
  entry: SpecDashboardSourceEntry | undefined,
  t: number,
  value: number | null,
  readOnlyReason: string,
): SpecDashboardEditMeta {
  if (
    entry &&
    typeof value === "number" &&
    Math.abs(entry.t - t) < 0.0001 &&
    Math.abs(entry.value - value) < 0.0001
  ) {
    return editableMeta(entry, readOnlyReason);
  }
  return { editable: false, editKind: null, id: null, readOnlyReason };
}

function normalizeSpecCamera(spec: Spec, requestedSamples: number, sourceIndex: SpecDashboardSourceIndex): DashboardCamera | null {
  const lane = spec.camera?.zoom;
  if (!lane) return null;

  const plan = specZoomLaneToRenderPlan(lane, spec.duration);
  if (!plan || plan.autoZoom.length === 0) return null;

  const keyframes = lane.keyframes
    .map((point, index) => ({
      id: `camera.zoom:${index}`,
      index,
      t: round(point.t, 4),
      zoom: round(point.zoom, 4),
      edit: matchingEditMetaFor(
        sourceIndex.zoomKeyframes.get(index),
        round(point.t, 4),
        round(point.zoom, 4),
        "Zoom keyframe is generated or not backed by a literal camera.zoom.keyframes entry",
      ),
    }))
    .filter((point) =>
      Number.isFinite(point.t) &&
      Number.isFinite(point.zoom) &&
      point.t >= 0 &&
      point.t <= spec.duration &&
      point.zoom > 0
    )
    .sort((a, b) => a.t - b.t || a.index - b.index);

  const count = Math.max(2, Math.min(Math.trunc(requestedSamples), plan.autoZoom.length));
  const points: [number, number][] = [];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : (spec.duration * i) / (count - 1);
    const frame = Math.max(0, Math.min(plan.autoZoom.length - 1, Math.round(t * FPS)));
    const zoom = round(plan.autoZoom[frame], 4);
    points.push([round(t, 4), zoom]);
    min = Math.min(min, zoom);
    max = Math.max(max, zoom);
  }

  return {
    zoom: {
      points,
      keyframes,
      renderKeyframes: plan.zoomKeyframes.map(([frame, log2Zoom], i) => ({
        i,
        frame,
        t: round(frame / FPS, 4),
        zoom: round(2 ** log2Zoom, 4),
        log2Zoom: round(log2Zoom, 4),
      })),
      smoothingFrames: plan.zoomSmoothing,
      min: round(min, 4),
      max: round(max, 4),
      count: points.length,
    },
  };
}

async function loadSpecView(rawSpec: string, requestedSamples: number): Promise<Record<string, unknown>> {
  const resolvedSpec = resolveListedSpec(rawSpec);
  if (!resolvedSpec) throw new Error(`unsupported spec path: ${rawSpec}`);

  const stat = statSync(resolvedSpec.absPath);
  const sourceIndex = readSpecDashboardSourceIndex(resolvedSpec.absPath);
  const sidecarPath = calibrationSelectionPath(resolvedSpec.absPath);
  const sidecarMtime = existsSync(sidecarPath) ? Math.trunc(statSync(sidecarPath).mtimeMs) : 0;
  const moduleUrl = `${pathToFileURL(resolvedSpec.absPath).href}?mtime=${Math.trunc(stat.mtimeMs)}&cal=${sidecarMtime}`;
  const mod = await import(moduleUrl) as Record<string, unknown>;
  const spec = mod.default as Spec | undefined;
  if (!spec || typeof spec.duration !== "number" || !Number.isFinite(spec.duration) || spec.duration <= 0) {
    throw new Error(`spec ${resolvedSpec.entry.path} did not export a valid default Spec`);
  }

  const sampleCount = Math.max(80, Math.min(3000, Math.trunc(requestedSamples)));
  const duration = spec.duration;
  const contacts = (Array.isArray(spec.contacts) ? spec.contacts : [])
    .map((contact, originalIndex) => ({
      i: originalIndex,
      t: round(contact.t, 4),
      frame: Math.round(contact.t * FPS),
      impact: typeof contact.impact === "number" && Number.isFinite(contact.impact)
        ? round(contact.impact, 4)
        : null,
      edit: matchingEditMetaFor(
        sourceIndex.contactImpacts.get(originalIndex),
        round(contact.t, 4),
        typeof contact.impact === "number" && Number.isFinite(contact.impact) ? round(contact.impact, 4) : null,
        typeof contact.impact === "number" && Number.isFinite(contact.impact)
          ? "Impact is generated or computed in the spec source"
          : "Contact has no literal impact target",
      ),
    }))
    .filter((contact) => Number.isFinite(contact.t) && contact.t >= 0 && contact.t <= duration)
    .sort((a, b) => a.t - b.t);

  const axes: Record<string, unknown> = {};
  const keyframes: Record<string, unknown>[] = [];
  const axisRanges: Record<string, { min: number; max: number; count: number }> = {};
  for (const axis of AXES) {
    const curve = spec.axes?.[axis];
    if (typeof curve !== "function") continue;
    const meta = normalizeCurveMeta(curve.meta);
    for (const point of Array.isArray(meta?.points) ? meta.points : []) {
      const p = point as { i: number; t: number; v: number; ease: string | null };
      keyframes.push({
        id: `${axis}:${p.i}`,
        axis,
        index: p.i,
        t: p.t,
        v: p.v,
        ease: p.ease ?? (typeof meta?.defaultEase === "string" ? meta.defaultEase : null),
        sourceEase: p.ease,
        kind: meta?.kind ?? "unknown",
        edit: matchingEditMetaFor(
          sourceIndex.axisKeyframes.get(`${axis}:${p.i}`),
          p.t,
          p.v,
          "Axis keyframe is generated or not backed by a literal keyframes([...]) entry",
        ),
      });
    }
    const points: [number, number | null][] = [];
    let min = Infinity;
    let max = -Infinity;
    let count = 0;
    for (let i = 0; i < sampleCount; i++) {
      const t = sampleCount === 1 ? 0 : (duration * i) / (sampleCount - 1);
      const value = axisValue(spec, axis, t);
      if (value === null) {
        points.push([round(t, 4), null]);
      } else {
        const v = round(value, 4);
        points.push([round(t, 4), v]);
        min = Math.min(min, v);
        max = Math.max(max, v);
        count++;
      }
    }
    axes[axis] = {
      points,
      min: count ? min : null,
      max: count ? max : null,
      count,
      meta,
    };
    if (count) axisRanges[axis] = { min, max, count };
  }
  keyframes.sort((a, b) =>
    (Number(a.t) - Number(b.t)) ||
    String(a.axis).localeCompare(String(b.axis)) ||
    (Number(a.index) - Number(b.index))
  );
  const camera = normalizeSpecCamera(spec, sampleCount, sourceIndex);
  const zoom = camera?.zoom ?? null;

  const gaps = contacts.map((contact, i) => {
    const t0 = i === 0 ? 0 : contacts[i - 1].t;
    const t1 = contact.t;
    const mid = Math.max(0, Math.min(duration, (t0 + t1) / 2));
    return {
      i,
      t0: round(t0, 4),
      t1: round(t1, 4),
      duration: round(Math.max(0, t1 - t0), 4),
      contactIndex: contact.i,
      contactT: contact.t,
      impact: contact.impact,
      targets: sampleAxesAt(spec, mid),
    };
  });

  const impacts = contacts
    .map((contact) => contact.impact)
    .filter((impact): impact is number => typeof impact === "number");
  const durations = gaps.map((gap) => gap.duration).filter((value) => Number.isFinite(value));

  return {
    spec: {
      name: resolvedSpec.entry.name,
      label: resolvedSpec.entry.label,
      path: resolvedSpec.entry.path,
      group: resolvedSpec.entry.group,
      duration,
      frameRate: FPS,
      jitter: spec.jitter ?? null,
      preroll: spec.preroll ?? null,
      start: spec.start ?? null,
    },
    summary: {
      contacts: contacts.length,
      gaps: gaps.length,
      activeAxes: Object.keys(axes),
      keyframes: keyframes.length,
      zoomKeyframes: zoom?.keyframes.length ?? 0,
      zoomMin: zoom?.min ?? null,
      zoomMax: zoom?.max ?? null,
      zoomSmoothingFrames: zoom?.smoothingFrames ?? null,
      impactTargets: impacts.length,
      minImpact: impacts.length ? Math.min(...impacts) : null,
      maxImpact: impacts.length ? Math.max(...impacts) : null,
      shortestGap: durations.length ? Math.min(...durations) : null,
      longestGap: durations.length ? Math.max(...durations) : null,
      axisRanges,
    },
    contacts,
    gaps,
    axes,
    keyframes,
    camera,
    calibration: calibrationInfo(mod, resolvedSpec.absPath, resolvedSpec.entry.path),
    overlayMeta: jsonClone(mod.overlayMeta),
    music: normalizeSpecMusic(spec.music),
  };
}

function specNotesPath(specPath: string): string {
  const name = cleanRunName(specPath.replace(/\.ts$/, "").replace(/[\\/]+/g, "__")) || "spec";
  return resolve(ROOT, "generated", "spec-dashboard", `${name}.notes.json`);
}

function specNotesRelPath(specPath: string): string {
  return toPosixPath(relative(ROOT, specNotesPath(specPath)));
}

function specEditsPath(specPath: string): string {
  const name = cleanRunName(specPath.replace(/\.ts$/, "").replace(/[\\/]+/g, "__")) || "spec";
  return resolve(ROOT, "generated", "spec-dashboard", `${name}.edits.json`);
}

function readSpecNotes(specPath: string): SpecNote[] {
  const file = specNotesPath(specPath);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed.notes) ? parsed.notes.filter(isSpecNote) : [];
  } catch {
    return [];
  }
}

function isSpecNote(value: unknown): value is SpecNote {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const note = value as Record<string, unknown>;
  return typeof note.id === "string" &&
    typeof note.t === "number" &&
    typeof note.text === "string" &&
    Array.isArray(note.tags);
}

function writeSpecNotes(specPath: string, notes: SpecNote[]): void {
  const file = specNotesPath(specPath);
  mkdirSync(dirname(file), { recursive: true });
  const body = {
    specPath,
    updatedAt: new Date().toISOString(),
    notes: notes.slice().sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)),
  };
  writeFileSync(file, JSON.stringify(body, null, 2) + "\n");
}

function readSpecEdits(specPath: string): SpecEdit[] {
  const file = specEditsPath(specPath);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed.edits) ? parsed.edits.filter(isSpecEdit) : [];
  } catch {
    return [];
  }
}

function isSpecEdit(value: unknown): value is SpecEdit {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const edit = value as Record<string, unknown>;
  return typeof edit.id === "string" &&
    typeof edit.target === "string" &&
    typeof edit.t === "number" &&
    typeof edit.title === "string";
}

function writeSpecEdits(specPath: string, edits: SpecEdit[]): void {
  const file = specEditsPath(specPath);
  mkdirSync(dirname(file), { recursive: true });
  const body = {
    specPath,
    updatedAt: new Date().toISOString(),
    edits: edits.slice().sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)),
  };
  writeFileSync(file, JSON.stringify(body, null, 2) + "\n");
}

function historyForSpec(specPath: string): SpecHistoryState {
  let history = specHistory.get(specPath);
  if (!history) {
    history = { undo: [], redo: [] };
    specHistory.set(specPath, history);
  }
  return history;
}

function snapshotFile(file: string): FileSnapshot {
  const path = normalize(resolve(file));
  if (!existsSync(path)) return { path, existed: false, contents: null };
  return { path, existed: true, contents: readFileSync(path, "utf8") };
}

function snapshotFiles(files: string[]): FileSnapshot[] {
  return [...new Set(files.map((file) => normalize(resolve(file))))]
    .sort((a, b) => a.localeCompare(b))
    .map(snapshotFile);
}

function sameSnapshot(a: FileSnapshot, b: FileSnapshot): boolean {
  return a.path === b.path && a.existed === b.existed && a.contents === b.contents;
}

function sameSnapshots(a: FileSnapshot[], b: FileSnapshot[]): boolean {
  return a.length === b.length && a.every((snapshot, index) => sameSnapshot(snapshot, b[index]));
}

function pushSpecHistory(specPath: string, label: string, before: FileSnapshot[], after: FileSnapshot[]): void {
  if (sameSnapshots(before, after)) return;
  const history = historyForSpec(specPath);
  history.undo.push({
    id: randomUUID(),
    specPath,
    label,
    createdAt: new Date().toISOString(),
    before,
    after,
  });
  if (history.undo.length > SPEC_HISTORY_LIMIT) history.undo.splice(0, history.undo.length - SPEC_HISTORY_LIMIT);
  history.redo = [];
}

function specHistoryStatus(specPath: string) {
  const history = historyForSpec(specPath);
  const undo = history.undo.at(-1) ?? null;
  const redo = history.redo.at(-1) ?? null;
  return {
    undoCount: history.undo.length,
    redoCount: history.redo.length,
    canUndo: Boolean(undo),
    canRedo: Boolean(redo),
    nextUndo: undo ? { id: undo.id, label: undo.label, createdAt: undo.createdAt } : null,
    nextRedo: redo ? { id: redo.id, label: redo.label, createdAt: redo.createdAt } : null,
  };
}

function restoreSnapshots(snapshots: FileSnapshot[]): void {
  for (const snapshot of snapshots) {
    if (!snapshot.existed) {
      rmSync(snapshot.path, { force: true });
      continue;
    }
    mkdirSync(dirname(snapshot.path), { recursive: true });
    writeFileSync(snapshot.path, snapshot.contents ?? "");
  }
}

function assertHistoryCurrent(entry: SpecHistoryEntry, expected: FileSnapshot[]): void {
  const current = snapshotFiles(expected.map((snapshot) => snapshot.path));
  if (!sameSnapshots(current, expected)) {
    throw new Error("current file no longer matches dashboard history; reload before undo/redo");
  }
}

function applySpecHistoryAction(specPath: string, action: "undo" | "redo") {
  const history = historyForSpec(specPath);
  if (action === "undo") {
    const entry = history.undo.at(-1);
    if (!entry) return { ok: true, action, entry: null, history: specHistoryStatus(specPath) };
    assertHistoryCurrent(entry, entry.after);
    restoreSnapshots(entry.before);
    history.undo.pop();
    history.redo.push(entry);
    return { ok: true, action, entry: historyEntrySummary(entry), history: specHistoryStatus(specPath) };
  }

  const entry = history.redo.at(-1);
  if (!entry) return { ok: true, action, entry: null, history: specHistoryStatus(specPath) };
  assertHistoryCurrent(entry, entry.before);
  restoreSnapshots(entry.after);
  history.redo.pop();
  history.undo.push(entry);
  return { ok: true, action, entry: historyEntrySummary(entry), history: specHistoryStatus(specPath) };
}

function historyEntrySummary(entry: SpecHistoryEntry) {
  return {
    id: entry.id,
    label: entry.label,
    createdAt: entry.createdAt,
  };
}

function editHistoryLabel(input: ApplySpecDashboardEditInput): string {
  if (input.editKind === "contactImpact") return "Edit contact impact";
  if (input.editKind === "zoomKeyframe") return "Edit zoom keyframe";
  return "Edit axis keyframe";
}

function cleanTags(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function cleanScope(value: unknown): SpecNote["scope"] {
  return value === "contact" || value === "gap" || value === "range" || value === "keyframe" ? value : "moment";
}

function cleanEditTarget(value: unknown): SpecEdit["target"] {
  return value === "contact" || value === "gap" || value === "range" || value === "keyframe" ? value : "moment";
}

function normalizeSpecNote(input: Record<string, unknown>, previous: SpecNote | undefined): SpecNote {
  const now = new Date().toISOString();
  const t = valueAsNumber(input, "t", previous?.t ?? 0);
  const scope = cleanScope(input.scope ?? previous?.scope);
  const rawIndex = input.index;
  const index = typeof rawIndex === "number" && Number.isFinite(rawIndex)
    ? Math.trunc(rawIndex)
    : previous?.index ?? null;
  const t0 = valueAsOptionalNumber(input, "t0", previous?.t0 ?? null);
  const t1 = valueAsOptionalNumber(input, "t1", previous?.t1 ?? null);
  const axis = (valueAsString(input, "axis") ?? previous?.axis ?? null)?.trim() || null;
  const fallbackId = `${scope}:${index ?? Math.round(Math.max(0, t) * 1000)}`;
  const id = (valueAsString(input, "id") ?? previous?.id ?? fallbackId)
    .trim()
    .replace(/[^A-Za-z0-9:._-]+/g, "_")
    .slice(0, 120);
  return {
    id,
    t: round(Math.max(0, t), 4),
    scope,
    index,
    t0: t0 === null ? null : round(Math.max(0, t0), 4),
    t1: t1 === null ? null : round(Math.max(0, t1), 4),
    axis,
    title: (valueAsString(input, "title") ?? previous?.title ?? scope).trim().slice(0, 160),
    text: (valueAsString(input, "text") ?? previous?.text ?? "").slice(0, 20000),
    tags: cleanTags(input.tags, previous?.tags ?? []),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
}

function normalizeSpecEdit(input: Record<string, unknown>, previous: SpecEdit | undefined): SpecEdit {
  const now = new Date().toISOString();
  const target = cleanEditTarget(input.target ?? previous?.target);
  const t = valueAsNumber(input, "t", previous?.t ?? 0);
  const rawIndex = input.index;
  const index = typeof rawIndex === "number" && Number.isFinite(rawIndex)
    ? Math.trunc(rawIndex)
    : previous?.index ?? null;
  const t0 = valueAsOptionalNumber(input, "t0", previous?.t0 ?? null);
  const t1 = valueAsOptionalNumber(input, "t1", previous?.t1 ?? null);
  const value = valueAsOptionalNumber(input, "value", previous?.value ?? null);
  const impact = valueAsOptionalNumber(input, "impact", previous?.impact ?? null);
  const axis = (valueAsString(input, "axis") ?? previous?.axis ?? null)?.trim() || null;
  const ease = (valueAsString(input, "ease") ?? previous?.ease ?? null)?.trim() || null;
  const fallbackId = `edit:${target}:${axis ?? index ?? Math.round(Math.max(0, t) * 1000)}`;
  const id = (valueAsString(input, "id") ?? previous?.id ?? fallbackId)
    .trim()
    .replace(/[^A-Za-z0-9:._-]+/g, "_")
    .slice(0, 140);
  return {
    id,
    target,
    t: round(Math.max(0, t), 4),
    index,
    t0: t0 === null ? null : round(Math.max(0, t0), 4),
    t1: t1 === null ? null : round(Math.max(0, t1), 4),
    axis,
    value: value === null ? null : round(Math.max(0, Math.min(1, value)), 4),
    ease,
    impact: impact === null ? null : round(Math.max(0, Math.min(1, impact)), 4),
    title: (valueAsString(input, "title") ?? previous?.title ?? target).trim().slice(0, 160),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
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

export function runNameInUse(name: string): boolean {
  const outPrefix = resolve(ROOT, "generated", "dashboard", name);
  const calibrationArchive = resolve(ROOT, "generated", "spec-calibration", name);
  const activeJob = [...jobs.values()].some((job) =>
    job.runName === name && (job.status === "queued" || job.status === "running")
  );
  return activeJob ||
    existsSync(resolve(ROOT, "shakedown", name)) ||
    existsSync(calibrationArchive) ||
    existsSync(`${outPrefix}.track.json`) ||
    existsSync(`${outPrefix}.report.json`);
}

export function uniqueRunName(base: string): string {
  let candidate = base;
  for (let i = 2; runNameInUse(candidate); i++) {
    candidate = `${base}_${i}`;
  }
  return candidate;
}

function startGenerateJob(body: Record<string, unknown>): DashboardJob {
  const rawSpec = valueAsString(body, "spec") ?? "";
  const resolvedSpec = resolveListedSpec(rawSpec);
  if (!resolvedSpec) throw new Error(`unsupported spec path: ${rawSpec}`);
  const specPath = resolvedSpec.entry.path;

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

export function parseSeedList(raw: string | null): number[] {
  const source = raw && raw.trim() ? raw : "0,1,2,3,4,5,6,7,8,9,10,11";
  const parts = source.split(",");
  if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
    throw new Error(`seeds must be a comma-separated list of integers, got ${source}`);
  }
  const seeds = parts.map((part) => Number(part.trim()));
  if (seeds.length === 0 || seeds.some((seed) => !Number.isSafeInteger(seed))) {
    throw new Error(`seeds must be a comma-separated list of integers, got ${source}`);
  }
  return [...new Set(seeds)].sort((a, b) => a - b);
}

function startCalibrationJob(body: Record<string, unknown>): DashboardJob {
  const rawSpec = valueAsString(body, "spec") ?? "";
  const resolvedSpec = resolveListedSpec(rawSpec);
  if (!resolvedSpec) throw new Error(`unsupported spec path: ${rawSpec}`);
  const specPath = resolvedSpec.entry.path;

  const budget = Math.trunc(valueAsNumber(body, "budget", 300_000));
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("budget must be a positive integer");
  const seeds = parseSeedList(valueAsString(body, "seeds"));
  const rawJobs = valueAsNumber(body, "jobs", Math.max(1, Math.floor(availableParallelism() / 2)));
  const jobCount = Math.max(1, Math.trunc(rawJobs));

  const specName = basename(specPath).replace(/\.ts$/, "");
  const runName = uniqueRunName(cleanRunName(`calibrate_${specName}_${compactTimestamp()}`));
  const archiveDir = resolve(ROOT, "generated", "spec-calibration", runName);
  const reportPath = resolve(archiveDir, "calibration.json");
  const dashboardUrl = `/spec-dashboard/?spec=${encodeURIComponent(specPath)}`;
  const reportUrl = workspaceUrl(reportPath);

  const now = new Date().toISOString();
  const job: DashboardJob = {
    id: randomUUID().slice(0, 8),
    kind: "calibrate",
    status: "queued",
    createdAt: now,
    updatedAt: now,
    runName,
    specPath,
    trackPath: null,
    reportPath: workspaceUrl(reportPath),
    dashboardUrl,
    reportUrl,
    logs: [],
  };
  jobs.set(job.id, job);
  void runCalibrationJob(job, { budget, seeds, jobs: jobCount, archiveDir });
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

async function runCalibrationJob(
  job: DashboardJob,
  opts: { budget: number; seeds: number[]; jobs: number; archiveDir: string },
): Promise<void> {
  job.status = "running";
  appendLog(job, `run=${job.runName}`);
  appendLog(job, `spec=${job.specPath}`);
  appendLog(job, `budget=${opts.budget}`);
  appendLog(job, `seeds=${opts.seeds.join(",")}`);
  try {
    await runTsx(job, [
      "scripts/v0/calibrate_spec.ts",
      `--spec=${job.specPath}`,
      `--budget=${opts.budget}`,
      `--seeds=${opts.seeds.join(",")}`,
      `--jobs=${opts.jobs}`,
      `--out=${toPosixPath(relative(ROOT, opts.archiveDir))}`,
    ]);
    job.status = "succeeded";
    appendLog(job, `done: ${job.reportUrl}`);
  } catch (e) {
    job.status = "failed";
    job.error = String(e);
    appendLog(job, `ERROR: ${String(e)}`);
  } finally {
    job.updatedAt = new Date().toISOString();
  }
}

async function writeCalibrationSelection(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rawSpec = valueAsString(body, "spec") ?? "";
  const resolvedSpec = resolveListedSpec(rawSpec);
  if (!resolvedSpec) throw new Error(`unsupported spec path: ${rawSpec}`);

  const stat = statSync(resolvedSpec.absPath);
  const mod = await import(`${pathToFileURL(resolvedSpec.absPath).href}?mtime=${Math.trunc(stat.mtimeMs)}`) as Record<string, unknown>;
  if (!isSpecCalibration(mod.calibration)) {
    throw new Error("spec does not export calibration candidates");
  }
  const selected = valueAsString(body, "selected") ?? "identity";
  const ids = new Set(mod.calibration.candidates.map((candidate) => candidate.id));
  ids.add("identity");
  if (!ids.has(selected)) throw new Error(`unknown calibration candidate: ${selected}`);

  const enabled = valueAsBool(body, "enabled", selected !== "identity");
  const sourceReport = valueAsString(body, "sourceReport");
  const selection: CalibrationSelection = {
    version: 1,
    enabled,
    selected,
    updatedAt: new Date().toISOString(),
    ...(sourceReport ? { sourceReport } : {}),
  };
  const sidecarPath = calibrationSelectionPath(resolvedSpec.absPath);
  mkdirSync(dirname(sidecarPath), { recursive: true });
  writeFileSync(sidecarPath, JSON.stringify(selection, null, 2) + "\n");
  return {
    ok: true,
    specPath: resolvedSpec.entry.path,
    selection,
    selectionPath: workspaceUrl(sidecarPath),
  };
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
  if (url.pathname === "/api/spec-view") {
    if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
    try {
      const specPath = url.searchParams.get("spec") ?? "";
      const samples = parseInt(url.searchParams.get("samples") ?? "1200", 10);
      return json(res, await loadSpecView(specPath, Number.isFinite(samples) ? samples : 1200));
    } catch (e) {
      return json(res, { error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/spec-notes") {
    if (req.method === "GET") {
      const resolvedSpec = resolveListedSpec(url.searchParams.get("spec") ?? "");
      if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
      return json(res, {
        specPath: resolvedSpec.entry.path,
        notesPath: specNotesRelPath(resolvedSpec.entry.path),
        notes: readSpecNotes(resolvedSpec.entry.path),
      });
    }
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
        const b = body as Record<string, unknown>;
        const resolvedSpec = resolveListedSpec(valueAsString(b, "spec") ?? "");
        if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);

        if (valueAsBool(b, "clear", false)) {
          const notesFile = specNotesPath(resolvedSpec.entry.path);
          const before = snapshotFiles([notesFile]);
          writeSpecNotes(resolvedSpec.entry.path, []);
          const after = snapshotFiles([notesFile]);
          pushSpecHistory(resolvedSpec.entry.path, "Clear notes", before, after);
          return json(res, {
            ok: true,
            specPath: resolvedSpec.entry.path,
            notesPath: specNotesRelPath(resolvedSpec.entry.path),
            count: 0,
            notes: [],
            history: specHistoryStatus(resolvedSpec.entry.path),
          });
        }

        const notes = readSpecNotes(resolvedSpec.entry.path);
        const noteInput = b.note;
        const deleteId = valueAsString(b, "id");
        if (noteInput == null) {
          if (!deleteId) return json(res, { error: "missing note or id" }, 400);
          const notesFile = specNotesPath(resolvedSpec.entry.path);
          const before = snapshotFiles([notesFile]);
          const next = notes.filter((note) => note.id !== deleteId);
          writeSpecNotes(resolvedSpec.entry.path, next);
          const after = snapshotFiles([notesFile]);
          pushSpecHistory(resolvedSpec.entry.path, "Delete note", before, after);
          return json(res, {
            ok: true,
            specPath: resolvedSpec.entry.path,
            notesPath: specNotesRelPath(resolvedSpec.entry.path),
            count: next.length,
            history: specHistoryStatus(resolvedSpec.entry.path),
          });
        }
        if (typeof noteInput !== "object" || Array.isArray(noteInput)) {
          return json(res, { error: "note must be an object" }, 400);
        }

        const input = noteInput as Record<string, unknown>;
        const incomingId = valueAsString(input, "id");
        const previous = incomingId ? notes.find((note) => note.id === incomingId) : undefined;
        const note = normalizeSpecNote(input, previous);
        const without = notes.filter((existing) => existing.id !== note.id);
        const isEmpty = !note.text.trim() && note.tags.length === 0;
        const next = isEmpty ? without : [...without, note];
        const notesFile = specNotesPath(resolvedSpec.entry.path);
        const before = snapshotFiles([notesFile]);
        writeSpecNotes(resolvedSpec.entry.path, next);
        const after = snapshotFiles([notesFile]);
        // An empty upsert of an existing note removes it (isEmpty → `without`), so label
        // it a deletion; an empty brand-new note is a no-op pushSpecHistory drops outright.
        const label = isEmpty ? "Delete note" : previous ? "Edit note" : "Add note";
        pushSpecHistory(resolvedSpec.entry.path, label, before, after);
        return json(res, {
          ok: true,
          specPath: resolvedSpec.entry.path,
          notesPath: specNotesRelPath(resolvedSpec.entry.path),
          count: next.length,
          note: isEmpty ? null : note,
          history: specHistoryStatus(resolvedSpec.entry.path),
        });
      } catch (e) {
        return json(res, { error: String(e) }, 400);
      }
    }
    return json(res, { error: "method not allowed" }, 405);
  }
  if (url.pathname === "/api/spec-apply-edit") {
    if (req.method !== "POST") return json(res, { error: "method not allowed" }, 405);
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
      const b = body as Record<string, unknown>;
      const resolvedSpec = resolveListedSpec(valueAsString(b, "spec") ?? "");
      if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
      const editKind = valueAsString(b, "editKind");
      const id = valueAsString(b, "id");
      if (editKind !== "axisKeyframe" && editKind !== "zoomKeyframe" && editKind !== "contactImpact") {
        return json(res, { error: "unsupported edit kind" }, 400);
      }
      if (!id) return json(res, { error: "missing edit id" }, 400);

      const input: ApplySpecDashboardEditInput = {
        editKind,
        id,
        t: valueAsOptionalNumber(b, "t"),
        value: valueAsOptionalNumber(b, "value"),
        impact: valueAsOptionalNumber(b, "impact"),
        ease: valueAsString(b, "ease"),
      };
      const before = snapshotFiles([resolvedSpec.absPath]);
      const target = applySpecDashboardEdit(resolvedSpec.absPath, input);
      const after = snapshotFiles([resolvedSpec.absPath]);
      pushSpecHistory(resolvedSpec.entry.path, editHistoryLabel(input), before, after);
      return json(res, {
        ok: true,
        specPath: resolvedSpec.entry.path,
        target,
        history: specHistoryStatus(resolvedSpec.entry.path),
      });
    } catch (e) {
      return json(res, { error: String(e) }, 400);
    }
  }
  if (url.pathname === "/api/spec-history") {
    if (req.method === "GET") {
      const resolvedSpec = resolveListedSpec(url.searchParams.get("spec") ?? "");
      if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
      return json(res, {
        specPath: resolvedSpec.entry.path,
        history: specHistoryStatus(resolvedSpec.entry.path),
      });
    }
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
        const b = body as Record<string, unknown>;
        const resolvedSpec = resolveListedSpec(valueAsString(b, "spec") ?? "");
        if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
        const action = valueAsString(b, "action");
        if (action !== "undo" && action !== "redo") return json(res, { error: "unsupported history action" }, 400);
        return json(res, applySpecHistoryAction(resolvedSpec.entry.path, action));
      } catch (e) {
        return json(res, { error: String(e) }, 409);
      }
    }
    return json(res, { error: "method not allowed" }, 405);
  }
  if (url.pathname === "/api/spec-edits") {
    if (req.method === "GET") {
      const resolvedSpec = resolveListedSpec(url.searchParams.get("spec") ?? "");
      if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
      return json(res, { specPath: resolvedSpec.entry.path, edits: readSpecEdits(resolvedSpec.entry.path) });
    }
    if (req.method === "POST") {
      try {
        const body = await readJsonBody(req);
        if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
        const b = body as Record<string, unknown>;
        const resolvedSpec = resolveListedSpec(valueAsString(b, "spec") ?? "");
        if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);

        if (valueAsBool(b, "clear", false)) {
          writeSpecEdits(resolvedSpec.entry.path, []);
          return json(res, { ok: true, specPath: resolvedSpec.entry.path, count: 0, edits: [] });
        }

        const edits = readSpecEdits(resolvedSpec.entry.path);
        const editInput = b.edit;
        const deleteId = valueAsString(b, "id");
        if (editInput == null) {
          if (!deleteId) return json(res, { error: "missing edit or id" }, 400);
          const next = edits.filter((edit) => edit.id !== deleteId);
          writeSpecEdits(resolvedSpec.entry.path, next);
          return json(res, { ok: true, specPath: resolvedSpec.entry.path, count: next.length, edits: next });
        }
        if (typeof editInput !== "object" || Array.isArray(editInput)) {
          return json(res, { error: "edit must be an object" }, 400);
        }

        const input = editInput as Record<string, unknown>;
        const incomingId = valueAsString(input, "id");
        const previous = incomingId ? edits.find((edit) => edit.id === incomingId) : undefined;
        const edit = normalizeSpecEdit(input, previous);
        const next = [...edits.filter((existing) => existing.id !== edit.id), edit];
        writeSpecEdits(resolvedSpec.entry.path, next);
        return json(res, { ok: true, specPath: resolvedSpec.entry.path, count: next.length, edit, edits: next });
      } catch (e) {
        return json(res, { error: String(e) }, 400);
      }
    }
    return json(res, { error: "method not allowed" }, 405);
  }
  if (url.pathname === "/api/spec-calibration/latest") {
    if (req.method !== "GET") return json(res, { error: "method not allowed" }, 405);
    const resolvedSpec = resolveListedSpec(url.searchParams.get("spec") ?? "");
    if (!resolvedSpec) return json(res, { error: "missing or unsupported spec" }, 400);
    return json(res, {
      specPath: resolvedSpec.entry.path,
      latest: latestCalibrationReport(resolvedSpec.entry.path),
    });
  }
  if (url.pathname === "/api/spec-calibration/jobs" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
      const job = startCalibrationJob(body as Record<string, unknown>);
      return json(res, { job: snapshotJob(job) }, 202);
    } catch (e) {
      return json(res, { error: String(e) }, 400);
    }
  }
  const calibrationJobMatch = /^\/api\/spec-calibration\/jobs\/([^/]+)$/.exec(url.pathname);
  if (calibrationJobMatch) {
    const job = jobs.get(calibrationJobMatch[1]);
    if (!job || job.kind !== "calibrate") return json(res, { error: "job not found" }, 404);
    return json(res, { job: snapshotJob(job) });
  }
  if (url.pathname === "/api/spec-calibration/selection" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      if (!body || typeof body !== "object" || Array.isArray(body)) return json(res, { error: "expected JSON object" }, 400);
      return json(res, await writeCalibrationSelection(body as Record<string, unknown>));
    } catch (e) {
      return json(res, { error: String(e) }, 400);
    }
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

function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && fileURLToPath(import.meta.url) === resolve(entry);
}

if (isCliEntry()) {
  server.listen(PORT, HOST, () => {
    console.log(`serving ${ROOT} on ${HOST}:${PORT}`);
    for (const host of accessHosts(HOST)) {
      console.log(`Dashboard: http://${host}:${PORT}/dashboard/`);
      console.log(`Spec dashboard: http://${host}:${PORT}/spec-dashboard/`);
    }
  });
}
