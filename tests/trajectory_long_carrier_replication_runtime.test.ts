import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "vitest";
import {
  longCarrierReplicationCaptureRuntimeIdentity,
  longCarrierReplicationRuntimePackageClosure,
} from "../scripts/v0/trajectory/long_carrier_replication_runtime.ts";

describe("long-carrier capture runtime identity", () => {
  test("content-addresses runtime package code rather than manifest versions", () => {
    const root = mkdtempSync(join(tmpdir(), "line-long-carrier-runtime-closure-"));
    try {
      const packageRoots = {
        tsx: writePackage(root, "tsx", { "package.json": '{"version":"test"}', "dist/loader.mjs": "export default 1;" }),
        typescript: writePackage(root, "typescript", { "package.json": '{"version":"test"}', "lib/typescript.js": "module.exports = 1;" }),
        esbuild: writePackage(root, "esbuild", { "package.json": '{"version":"test"}', "lib/main.js": "module.exports = 1;" }),
        "@esbuild/test-x64": writePackage(root, "@esbuild/test-x64", { "package.json": '{"version":"test"}', "bin/esbuild": "binary-v1" }),
      };
      const before = longCarrierReplicationRuntimePackageClosure(packageRoots);
      writeFileSync(join(packageRoots.tsx, "dist", "loader.mjs"), "export default 2;");
      const after = longCarrierReplicationRuntimePackageClosure(packageRoots);

      expect(after.packages).toEqual(["@esbuild/test-x64", "esbuild", "tsx", "typescript"]);
      expect(after.fingerprint).not.toBe(before.fingerprint);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records the installed loader, transpiler, wrapper, and native binary closure", () => {
    const identity = longCarrierReplicationCaptureRuntimeIdentity();
    expect(identity.runtimePackages).toEqual([
      `@esbuild/${process.platform}-${process.arch}`,
      "esbuild",
      "tsx",
      "typescript",
    ].sort());
    expect(identity.runtimePackageClosureFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});

function writePackage(root: string, packageName: string, files: Record<string, string>): string {
  const packageRoot = join(root, ...packageName.split("/"));
  for (const [relativePath, contents] of Object.entries(files)) {
    const output = join(packageRoot, ...relativePath.split("/"));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, contents);
  }
  return packageRoot;
}
