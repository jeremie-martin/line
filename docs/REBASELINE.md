# Re-baselining the golden budget curve

When you change the compiler and want to record a new score baseline, source
numbers from the golden JSON. Do not transcribe scores by hand.

## 1. Run the curve and capture JSON

```bash
# Full canonical run = 40 specs × 12 seeds × budgets {125,250,375,500}k
# (each budget is an independent run).
LR_ENGINE=wasm npm run golden -- --jobs 32 --archive-dir=generated/golden-runs/rebaseline
```

The JSON contains the `headline` block (`kind`, `tier`, `score`, `weight_by_budget`,
`budgets`, `validity`) — the **baseline of record** — plus `budget_scores`,
`evaluator_fingerprint`, `source` git metadata, `scope`, and checkpoint rows with
compact stats and track hashes. The run writes
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
ruler: `scripts/v0/score.ts`, the authored-speed ruler/conversions, axis
measurement/report assembly, and every `specs/golden/*.ts`. The harness prints
the live fingerprint on every run and warns when it differs from the committed
constant.

- Compiler-only changes leave the ruler unchanged. Do not touch the constant.
- Changes to the scorer, speed ruler, axis measurement/report assembly, or any
  golden spec are deliberate ruler changes. Update the constant in the same
  commit; scores before and after are not comparable.
- Changing `GOLDEN_SEEDS`, `DEFAULT_BUDGETS`, the budget weights, or the headline
  aggregation (`metric.ts`) does NOT change the fingerprint (it hashes the per-run
  ruler + golden specs only). It does change what a "canonical run" is, so re-baseline
  the recorded numbers — and `decide` will refuse to compare archives whose
  fingerprint differs, whose budget weighting differs, or that predate the
  weighted-average metric (no `headline.kind`), so a stale baseline fails loudly
  rather than silently.

Recompute without a full run using the same source slices as
`scripts/v0/golden.ts`:

```bash
node --input-type=module -e 'import{readFileSync,readdirSync}from"node:fs";import{resolve}from"node:path";import{createHash}from"node:crypto";const s=(p,a,b)=>{const x=readFileSync(resolve(p),"utf8"),i=x.indexOf(a);if(i<0)throw Error(a);if(b===undefined)return x.slice(i);const j=x.indexOf(b,i);if(j<0)throw Error(b);return x.slice(i,j)};const h=createHash("sha256");h.update(readFileSync(resolve("scripts/v0/score.ts")));h.update("\0speed-ruler\0");h.update(s("scripts/v0/types.ts","export const SPEED_RULER","export const SPEED_AXIS"));h.update("\0effective-axes\0");h.update(s("scripts/v0/core/substrate.ts","export function effectiveAxes","// ─────────── Cross-gap target sampling"));h.update("\0axis-measurement\0");h.update(s("scripts/v0/core/measure.ts","/** Airborne-frame fraction over [gap.start, rangeEndFrame]. */"));h.update("\0drift-report\0");h.update(s("scripts/v0/core/substrate.ts","export function buildDriftReport","export function measureAxisOverRange"));for(const f of readdirSync(resolve("specs/golden")).filter(n=>n.endsWith(".ts")).sort()){h.update("\0golden-spec\0");h.update(readFileSync(resolve("specs/golden",f)))}console.log(h.digest("hex").slice(0,12))'
```

## 3. Files to update

### a) `docs/handoff-compiler.html`

Run the generator:

```bash
npx tsx scripts/v0/update_compiler_doc.ts generated/golden-runs/rebaseline/golden.json
```

It fills the baseline regions from the curve JSON: hero label, weighted HEADLINE
score, the budget table, largest-budget per-spec rows, and the campaign chart point.

### b) `docs/HOW_TO_WORK.md` — "Current baseline (of record)"

Step (a) already regenerates the full per-budget / per-spec baseline into
`docs/handoff-compiler.html` from the curve JSON — that generated doc **is** the
recorded baseline; do not hand-transcribe a second copy. Just refresh the one-line
orientation snapshot in HOW_TO_WORK's "Current baseline" section (headline figure,
default placement, fingerprint) so a reader sees the current number at a glance.

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
