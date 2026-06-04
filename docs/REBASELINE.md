# Re-baselining the golden budget curve

When you change the compiler and want to record a new score baseline, source
numbers from the golden JSON. Do not transcribe scores by hand.

## 1. Run the curve and capture JSON

```bash
npx tsx scripts/v0/golden.ts --jobs=4 --archive-dir=generated/golden-runs/rebaseline
```

The JSON contains `curve_score`, `budgets`, `budget_scores`,
`evaluator_fingerprint`, `source` git metadata, `scope`, and checkpoint rows
with compact stats and track hashes. The run writes
`generated/golden-runs/rebaseline/golden.json` and
checkpoint track/report artifacts under `generated/golden-runs/rebaseline/checkpoints/`.

Quick peek:

```bash
npx tsx scripts/v0/analyze_golden_curve.ts generated/golden-runs/rebaseline/golden.json
```

## 2. Does the fingerprint change?

`EVALUATOR_FINGERPRINT` in `scripts/v0/golden_suite.ts` is a sha256 of the
ruler: `scripts/v0/score.ts`, the authored-speed ruler/conversions, axis
measurement/report assembly, and every `specs/golden/*.ts`. The harness prints
the live fingerprint on every run and warns when it differs from the committed
constant.

- Compiler-only changes leave the ruler unchanged. Do not touch the constant.
- Changes to the scorer, speed ruler, axis measurement/report assembly, or any
  golden spec are deliberate ruler changes. Update the constant in the same
  commit; scores before and after are not comparable.

Recompute without a full run using the same source slices as
`scripts/v0/golden.ts`:

```bash
node --input-type=module -e 'import{readFileSync,readdirSync}from"node:fs";import{resolve}from"node:path";import{createHash}from"node:crypto";const s=(p,a,b)=>{const x=readFileSync(resolve(p),"utf8"),i=x.indexOf(a);if(i<0)throw Error(a);if(b===undefined)return x.slice(i);const j=x.indexOf(b,i);if(j<0)throw Error(b);return x.slice(i,j)};const h=createHash("sha256");h.update(readFileSync(resolve("scripts/v0/score.ts")));h.update("\0speed-ruler\0");h.update(s("scripts/v0/types.ts","export const SPEED_RULER","const speedAuthoredBreakpointToPx"));h.update("\0effective-axes\0");h.update(s("scripts/v0/core/substrate.ts","export function effectiveAxes","// ─────────── Cross-gap target sampling"));h.update("\0axis-measurement\0");h.update(s("scripts/v0/core/measure.ts","/** Airborne-frame fraction over [gap.start, rangeEndFrame]. */"));h.update("\0drift-report\0");h.update(s("scripts/v0/core/substrate.ts","export function buildDriftReport","export function measureAxisOverRange"));for(const f of readdirSync(resolve("specs/golden")).filter(n=>n.endsWith(".ts")).sort()){h.update("\0golden-spec\0");h.update(readFileSync(resolve("specs/golden",f)))}console.log(h.digest("hex").slice(0,12))'
```

## 3. Files to update

### a) `docs/handoff-compiler.html`

Run the generator:

```bash
npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/rebaseline/golden.json
```

It fills the baseline regions from the curve JSON: hero label, `CURVE_SCORE`,
the budget table, largest-budget per-spec rows, and the campaign chart point.

### b) `GOAL_LDS_LOW_BUDGET.md`

Update the current baseline prose with `curve_score`, the budget grid,
largest-budget valid rows, and the fingerprint. Update the frontier section if
the curve shape changed materially.

### c) `scripts/v0/golden_suite.ts`

Only update `EVALUATOR_FINGERPRINT` if the ruler changed.

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
