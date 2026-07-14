import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
  readSealedReplicationRecord,
  replicationRelativePath,
  resolveReplicationPath,
  writeSealedReplicationRecord,
} from "../scripts/v0/trajectory/long_carrier_replication_records.ts";

describe("long-carrier replication records", () => {
  test("writes a no-clobber self-checking record", () => {
    const root = mkdtempSync(join(tmpdir(), "line-replication-record-"));
    const path = join(root, "event.json");
    const record = writeSealedReplicationRecord(path, {
      schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
      kind: "plan",
      id: "case-a",
    }, "test event");

    expect(existsSync(path)).toBe(true);
    expect(readSealedReplicationRecord(path, LONG_CARRIER_REPLICATION_EVENT_SCHEMA, "test event"))
      .toEqual(record);
    expect(() => writeSealedReplicationRecord(path, {
      schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
      kind: "replacement",
    }, "test event")).toThrow(/immutable/);
  });

  test("rejects a tampered record and artifact path escape", () => {
    const root = mkdtempSync(join(tmpdir(), "line-replication-record-"));
    const path = join(root, "event.json");
    writeSealedReplicationRecord(path, {
      schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
      kind: "plan",
      id: "case-a",
    }, "test event");
    const tampered = JSON.parse(readFileSync(path, "utf8"));
    tampered.id = "case-b";
    // A sibling file is deliberately not authoritative just because it is JSON.
    const tamperedPath = join(root, "tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(tampered));

    expect(() => readSealedReplicationRecord(tamperedPath, LONG_CARRIER_REPLICATION_EVENT_SCHEMA, "tampered event"))
      .toThrow(/fingerprint/);
    expect(() => resolveReplicationPath(root, "../outside.json", "artifact")).toThrow(/escapes/);
    expect(replicationRelativePath(root, join(root, "fixtures", "a.json"), "artifact"))
      .toBe("fixtures/a.json");
  });
});
