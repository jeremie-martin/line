/**
 * migrate_spec_impact — reusable, NON-DESTRUCTIVE helper for the scored impact convention.
 *
 * The scored impact is the redirection impulse `cArc = Σ v̄·|Δθ|` (`contactRedirArcPxAtLanding`,
 * substrate.ts; promoted 2026-07-31 over the net-form `redirArc = v·Δθ`), felt-normalized to
 * [0,1] via REDIRARC.SOFT/VSTRONG — read the live values from types.ts rather than trusting a
 * number copied into prose. New specs author NATIVELY on that scale (0 = soft … 1 = very strong) with
 * `withImpact`. OLD-convention specs (felt-"soft" ≈ 0.2 on the pre-redirArc scale) are brought onto
 * the new scale by the affine convention shift `migrateImpact(a) = clamp01((a − 0.2)/0.8)`, applied
 * once at load by `withImpactLegacy` — which is now the default. This tool lets you, on any clone:
 *
 *   1) SEE what a spec's impact resolves to on the new scale (verify a migration):
 *        LR_ENGINE=wasm npx tsx scripts/v0/migrate_spec_impact.ts --spec=specs/golden/grain_staircase.ts
 *   2) CONVERT old-convention authored values to new (no spec needed):
 *        npx tsx scripts/v0/migrate_spec_impact.ts --convert=0.2,0.45,0.85
 *   3) Emit the resolved per-beat values to a JSON sidecar for review (NEVER rewrites the spec):
 *        ... --spec=path --out=generated/<name>.impact.json
 *
 * It never edits a spec in place — freezing to literals, if ever wanted, is a deliberate manual step
 * you do after reviewing this output.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { migrateImpact } from "./core/beats.ts";
import { REDIRARC } from "./types.ts";

const argv = process.argv.slice(2);
const arg = (n: string) => argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);

function banner() {
  console.log(`impact convention: redirArc felt scale, SOFT=${REDIRARC.SOFT} VSTRONG=${REDIRARC.VERY_STRONG}`);
  console.log(`migration: affine convention shift  a_new = clamp01((a_old − 0.2)/0.8)\n`);
}

const convert = arg("convert");
if (convert) {
  banner();
  console.log("old → new (affine convention shift):");
  for (const s of convert.split(",")) {
    const a = Number(s.trim());
    if (Number.isFinite(a)) console.log(`  ${a}  →  ${migrateImpact(a).toFixed(4)}`);
  }
  process.exit(0);
}

const specPath = arg("spec");
if (!specPath) {
  console.error("usage: --spec=<path>  (report a spec's resolved impact)  |  --convert=v1,v2,...  |  --spec=… --out=<json>");
  process.exit(1);
}

const mod = await import(resolve(specPath));
const spec = mod.default;
const beats = (spec.contacts as { t: number; impact?: number }[])
  .filter((c) => typeof c.impact === "number")
  .map((c) => ({ t: c.t, impact: +(c.impact as number).toFixed(4) }));

banner();
console.log(`${specPath}: ${beats.length} beats with impact (values shown are NEW-scale, after any migration applied at load):`);
const uniq = [...new Set(beats.map((b) => b.impact))].sort((a, b) => a - b);
console.log(`  distinct resolved impact values: ${uniq.join(", ")}`);
console.log(`  range ${Math.min(...uniq)} … ${Math.max(...uniq)}`);

const out = arg("out");
if (out) {
  writeFileSync(resolve(out), JSON.stringify({ spec: specPath, soft: REDIRARC.SOFT, vstrong: REDIRARC.VERY_STRONG, beats }, null, 2));
  console.log(`\nwrote resolved per-beat impact → ${out} (review-only; spec NOT modified)`);
}
