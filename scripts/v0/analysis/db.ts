/**
 * Lab database handle. SQLite via the Node 22 built-in `node:sqlite` —
 * zero external deps, and the file is equally readable from Python stdlib
 * `sqlite3` for ad-hoc human investigation.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DDL, SCHEMA_VERSION } from "./schema.ts";

export const DEFAULT_DB_PATH = resolve(
  import.meta.dirname,
  "../../../generated/analysis/lab.sqlite",
);

export type OpenOptions = {
  readonly?: boolean;
  dbPath?: string;
};

export function openLab(opts: OpenOptions = {}): DatabaseSync {
  const path = opts.dbPath ?? DEFAULT_DB_PATH;
  if (opts.readonly) {
    if (!existsSync(path)) {
      throw new Error(`lab database not found at ${path} — run \`npm run lab -- index\` first`);
    }
    const db = new DatabaseSync(path, { readOnly: true });
    checkVersion(db, path, { rebuildOnMismatch: false });
    return db;
  }

  mkdirSync(dirname(path), { recursive: true });
  let db = new DatabaseSync(path);
  if (!checkVersion(db, path, { rebuildOnMismatch: true })) {
    // Stale schema: drop the file and start over (full rebuild is < 2 min).
    db.close();
    rmSync(path, { force: true });
    rmSync(`${path}-wal`, { force: true });
    rmSync(`${path}-shm`, { force: true });
    db = new DatabaseSync(path);
  }
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(DDL);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)")
    .run(String(SCHEMA_VERSION));
  return db;
}

/** Returns false when the on-disk schema version mismatches (writable mode);
 *  throws in readonly mode since we cannot fix it there. */
function checkVersion(
  db: DatabaseSync,
  path: string,
  opts: { rebuildOnMismatch: boolean },
): boolean {
  const hasMeta = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta'")
    .get();
  if (hasMeta === undefined) return true; // fresh file
  const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  const version = row === undefined ? -1 : Number(row.value);
  if (version === SCHEMA_VERSION) return true;
  if (!opts.rebuildOnMismatch) {
    throw new Error(
      `lab database at ${path} has schema v${version}, expected v${SCHEMA_VERSION} — re-run \`npm run lab -- index\``,
    );
  }
  return false;
}

export function getMeta(db: DatabaseSync, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setMeta(db: DatabaseSync, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)").run(key, value);
}
