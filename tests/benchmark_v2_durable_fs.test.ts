import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  appendFileDurable,
  copyFileDurable,
  removeFileDurable,
  writeFileAtomicDurable,
  writeFileExclusiveDurable,
} from "../scripts/v0/benchmark_v2/durable_fs.ts";

describe("durable publication primitives", () => {
  test("atomically writes, appends, copies, and removes without temporary residue", () => {
    const dir = mkdtempSync(join(tmpdir(), "v2-durable-"));
    const source = join(dir, "source.json");
    writeFileAtomicDurable(source, "one\n");
    appendFileDurable(source, "two\n");
    expect(readFileSync(source, "utf8")).toBe("one\ntwo\n");

    const copy = join(dir, "copy.json");
    copyFileDurable(source, copy);
    expect(readFileSync(copy, "utf8")).toBe("one\ntwo\n");

    const exclusive = join(dir, "journal.json");
    writeFileExclusiveDurable(exclusive, "journal\n");
    expect(() => writeFileExclusiveDurable(exclusive, "replacement\n")).toThrow();
    removeFileDurable(exclusive);
    expect(existsSync(exclusive)).toBe(false);
    expect(readdirSync(dir).some((name) => name.includes(".tmp-"))).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a completed atomic replacement is always entirely old or new", () => {
    const dir = mkdtempSync(join(tmpdir(), "v2-durable-replace-"));
    const path = join(dir, "state.json");
    writeFileSync(path, "old\n");
    writeFileAtomicDurable(path, Buffer.from("new\n"));
    expect(readFileSync(path, "utf8")).toBe("new\n");
    rmSync(dir, { recursive: true, force: true });
  });
});
