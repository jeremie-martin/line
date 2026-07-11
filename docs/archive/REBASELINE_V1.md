# Re-baselining the golden budget curve

When you change the compiler and want to record a new score baseline, source
numbers from the golden JSON. Do not transcribe scores by hand.

## 1. Run the curve and capture JSON

```bash
# Full canonical run = 40 specs × 12 seed slots × budgets {75,150,225,350,475,550}k
# with disjoint per-budget actual seeds. Each budget is an independent run.
npm run golden -- --full --archive-dir=generated/golden-runs/rebaseline
```

The JSON contains the `headline` block (`kind`, `tier`, `score`, `weight_by_budget`,
`budgets`, `validity`) — the **baseline of record** — plus `seed_policy`,
`budget_scores`, `evaluator_fingerprint`, `source` git metadata, `scope`, and
checkpoint rows with compact stats, actual seeds, and track hashes. The run writes
`generated/golden-runs/rebaseline/golden.json` and
checkpoint track/report artifacts under `generated/golden-runs/rebaseline/checkpoints/`.

Quick peek (prints the HEADLINE metric and the per-budget curve):

```bash
npx tsx scripts/v0/analyze_golden_curve.ts generated/golden-runs/rebaseline/golden.json
```

To decide whether a candidate beats a baseline, use the paired-bootstrap VERDICT,
not an eyeballed score delta:

```bash
npx tsx scripts/v0/analyze_golden_curve.ts decide CANDIDATE/golden.json BASELINE/golden.json
# or: npm run decide -- CANDIDATE/golden.json BASELINE/golden.json
```

## 2. Does the fingerprint change?

`EVALUATOR_FINGERPRINT` in `scripts/v0/golden_suite.ts` is a sha256 of the
ruler: `scripts/v0/score.ts`, live impact anchors, impact migration config/source,
the authored-speed ruler/conversions, axis measurement/report assembly, and every
`specs/golden/*.ts`. The harness prints the live fingerprint on every run and warns
when it differs from the committed constant.

- Compiler-only changes leave the ruler unchanged. Do not touch the constant.
- Changes to the scorer, speed ruler, axis measurement/report assembly, or any
  golden spec are deliberate ruler changes. Update the constant in the same
  commit; scores before and after are not comparable.
- Changing seed slots, `DEFAULT_BUDGETS`, the budget weights, seed policy, or the
  headline aggregation (`metric.ts`) does NOT change the fingerprint (it hashes the
  per-run ruler + golden specs only). It does change what a "canonical run" is, so
  re-baseline the recorded numbers — and `decide` will refuse to compare archives
  whose fingerprint differs, whose budget weighting differs, whose seed policy
  differs, or that predate the weighted-average metric / seed-policy metadata.

Recompute without a full run using the same source slices as
`scripts/v0/golden.ts`:

```bash
npx tsx -e 'import{readFileSync,readdirSync}from"node:fs";import{resolve}from"node:path";import{createHash}from"node:crypto";import{REDIRARC,impactEnvNum}from"./scripts/v0/types.ts";const z="\u0000";const s=(p:string,a:string,b?:string)=>{const x=readFileSync(resolve(p),"utf8"),i=x.indexOf(a);if(i<0)throw Error(a);if(b===undefined)return x.slice(i);const j=x.indexOf(b,i);if(j<0)throw Error(b);return x.slice(i,j)};const mode=process.env.LR_IMPACT_MIGRATE==="legacy"?"legacy":"affine";const mig=mode==="legacy"?mode:[mode,impactEnvNum("LR_IMPACT_MIGRATE_SOFT",0.2),impactEnvNum("LR_IMPACT_MIGRATE_SPAN",0.8)].join(z);const h=createHash("sha256");h.update(readFileSync(resolve("scripts/v0/score.ts")));h.update(`${z}impact-anchors${z}${REDIRARC.SOFT}${z}${REDIRARC.VERY_STRONG}`);h.update(`${z}impact-migration-config${z}${mig}`);h.update(`${z}impact-migration-source${z}`);h.update(s("scripts/v0/core/beats.ts","/**\n * Migrate an OLD-convention authored impact"));h.update(`${z}speed-ruler${z}`);h.update(s("scripts/v0/types.ts","export const SPEED_RULER","export const SPEED_AXIS"));h.update(`${z}effective-axes${z}`);h.update(s("scripts/v0/core/substrate.ts","export function effectiveAxes","// ─────────── Cross-gap target sampling"));h.update(`${z}axis-measurement${z}`);h.update(s("scripts/v0/core/measure.ts","/** Airborne-frame fraction over [gap.start, rangeEndFrame]. */"));h.update(`${z}drift-report${z}`);h.update(s("scripts/v0/core/substrate.ts","export function buildDriftReport","export function measureAxisOverRange"));for(const f of readdirSync(resolve("specs/golden")).filter(n=>n.endsWith(".ts")).sort()){h.update(`${z}golden-spec${z}`);h.update(readFileSync(resolve("specs/golden",f)))}console.log(h.digest("hex").slice(0,12))'
```

## 3. Files to update

### a) `docs/archive/handoff-compiler-v1.html`

Run the generator:

```bash
npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/rebaseline/golden.json
```

It fills the baseline regions from the curve JSON: hero label, weighted HEADLINE
score, the budget table, largest-budget per-spec rows, and the campaign chart point.

### b) `docs/HOW_TO_WORK.md` — "Current baseline (of record)"

Step (a) already regenerates the full per-budget / per-spec baseline into
`docs/archive/handoff-compiler-v1.html` from the curve JSON — that generated doc **is** the
recorded baseline; do not hand-transcribe a second copy. Just refresh the one-line
orientation snapshot in HOW_TO_WORK's "Current baseline" section (headline figure,
default placement, fingerprint) so a reader sees the current number at a glance.

### c) `scripts/v0/golden_suite.ts`

Update `EVALUATOR_FINGERPRINT` when the live ruler hash changes. If the constant is
stale relative to an already-recorded same-ruler baseline, refresh it as metadata
hygiene and say explicitly that scorer/spec/ruler source did not change.

## 4. Verify and commit

```bash
npx vitest run tests/v0_golden_config.test.ts
git add -A && git commit
```

A fresh run should print no fingerprint drift warning.

## What is not a re-baseline

- Golden archives under `generated/golden-runs/` are working artifacts, not
  source. They are gitignored by the top-level `generated/` rule.
- The dashboard reads report JSON live; regenerate artifacts instead of
  committing them.
