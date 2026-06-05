/**
 * One command to run every engine check — the durable "did we forget anything"
 * checklist. Builds the wasm, ensures baselines exist, then runs the regression
 * suite (must stay green: WASM matches JS) and the Phase-2b gates (red until
 * forking+invalidation lands), printing a summary. Exits non-zero only if a
 * REGRESSION check fails — Phase-2b gaps are expected and reported, not failures.
 *
 *   npm run wasm:all
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

type Kind = "regression" | "gate" | "info";
interface Check { name: string; cmd: string; args: string[]; env?: Record<string, string>; kind: Kind; what: string }

function run(cmd: string, args: string[], env?: Record<string, string>) {
  return spawnSync(cmd, args, { encoding: "utf8", timeout: 600_000, env: { ...process.env, ...env } });
}

function main() {
  console.log("\n=== build wasm ===");
  const b = run("npm", ["run", "build:wasm"]);
  if (b.status !== 0) { console.log("build:wasm FAILED\n" + (b.stderr || "")); process.exit(1); }

  if (!existsSync(resolve("generated/trace/synthetic-200.dump.json"))) {
    console.log("=== recording JS baselines (first run) ===");
    run("npm", ["run", "trace:dump", "--", "--update"]);
  }

  const checks: Check[] = [
    { name: "wasm:check", cmd: "npm", args: ["run", "wasm:check"], kind: "regression", what: "batch kernel vs dumps (5 fixtures); proves f64/sqrt bit-identity" },
    { name: "wasm:engine", cmd: "npm", args: ["run", "wasm:engine"], kind: "regression", what: "stateful lazy engine vs dumps" },
    { name: "trace (wasm)", cmd: "npm", args: ["run", "trace"], env: { LR_ENGINE: "wasm" }, kind: "regression", what: "oracle: state+contacts via WASM" },
    { name: "trace:diff (wasm)", cmd: "npm", args: ["run", "trace:diff"], env: { LR_ENGINE: "wasm" }, kind: "regression", what: "numeric microscope via WASM" },
    { name: "wasm:diff", cmd: "npm", args: ["run", "wasm:diff"], kind: "gate", what: "differential (forking + op-space)" },
    { name: "wasm:budget", cmd: "npm", args: ["run", "wasm:budget"], kind: "gate", what: "mid-stream addLine budget parity" },
    { name: "wasm:compile", cmd: "npm", args: ["run", "wasm:compile"], kind: "gate", what: "Tier-3 end-to-end track hash" },
    { name: "wasm:bench", cmd: "npm", args: ["run", "wasm:bench"], kind: "info", what: "kernel speed" },
  ];
  if (existsSync(resolve("generated/trace/compile_ops.json"))) {
    // insert before wasm:bench (the trailing info check)
    checks.splice(checks.length - 1, 0, { name: "wasm:replay", cmd: "npm", args: ["run", "wasm:replay"], kind: "gate", what: "captured-trace (real op DAG)" });
  }

  const results: { name: string; kind: Kind; status: string; bad: boolean }[] = [];
  for (const c of checks) {
    process.stdout.write(`\n=== ${c.name} ===\n`);
    const r = run(c.cmd, c.args, c.env);
    // 0 = pass; 2 = known Phase-2b gap; other = failure
    let status: string, bad = false;
    if (r.status === 0) status = c.kind === "gate" ? "PASS (gate now green!)" : "PASS";
    else if (r.status === 2 && c.kind === "gate") status = "gap (expected pre-2b)";
    else { status = `FAIL (exit ${r.status})`; bad = c.kind === "regression"; }
    results.push({ name: c.name, kind: c.kind, status, bad });
    // echo the check's own summary line(s)
    const tail = (r.stdout || "").trim().split("\n").slice(-3).join("\n");
    if (tail) console.log(tail);
  }

  console.log("\n========== ENGINE CHECK SUMMARY ==========");
  for (const grp of ["regression", "gate", "info"] as Kind[]) {
    console.log(`\n[${grp}]`);
    for (const r of results.filter((r) => r.kind === grp)) {
      console.log(`  ${r.name.padEnd(18)} ${r.status}`);
    }
  }
  const regressed = results.filter((r) => r.bad);
  console.log("");
  if (regressed.length) {
    console.log(`REGRESSION: ${regressed.map((r) => r.name).join(", ")} — the WASM engine diverged from JS. STOP.`);
    process.exit(1);
  }
  const gatesGreen = results.filter((r) => r.kind === "gate" && r.status.startsWith("PASS")).length;
  const gatesTotal = results.filter((r) => r.kind === "gate").length;
  console.log(`Regression suite GREEN. Phase-2b gates: ${gatesGreen}/${gatesTotal} green.`);
  console.log(gatesGreen === gatesTotal ? "ALL ENGINE CHECKS GREEN 🎉" : "(Phase-2b gates red-by-design until forking+invalidation lands.)");
}

main();
