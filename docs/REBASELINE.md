# Re-baselining the golden suite

When you change the compiler and want to record a new score baseline, this is
the full checklist. There are two cases — read "Does the fingerprint change?"
first, it decides how much you touch.

## 1. Run the suite, capture the JSON

Always source numbers from the run output — never transcribe a score by hand.

```bash
npx tsx scripts/v0/golden.ts --json --budget=50000 --jobs=4 > /tmp/g.json
```

The 50k budget is the campaign run of record (see `GOAL_LDS_LOW_BUDGET.md`).
The JSON has everything: `goal_score`, `passed`/`total`, `contract_pass_rate`,
`budget_units`, `evaluator_fingerprint`, and per-spec `spec_scores`.

Quick peek:

```bash
node -e 'const d=require("/tmp/g.json");console.log("goal",d.goal_score,"valid",d.passed+"/"+d.total,"rate",Math.round(d.contract_pass_rate*100)+"%","fp",d.evaluator_fingerprint)'
```

## 2. Does the fingerprint change?

`EVALUATOR_FINGERPRINT` (in `scripts/v0/golden_suite.ts`) is a sha256 of the
**ruler** = `scripts/v0/score.ts` + every `specs/golden/*.ts`. The harness
prints the live fingerprint on every run and warns `⚠ DRIFTED` when it differs
from the committed constant.

- **You changed only compiler code** (`optimizer/*.ts`, `core/candidate.ts`,
  `core/polish.ts`, `core/substrate.ts`, etc.) → ruler unchanged → fingerprint
  stays the same. **Do not touch the constant.** You're just recording new
  scores.
- **You changed `score.ts` or any golden spec** (added/removed/edited a spec,
  changed a tolerance) → ruler changed → the run prints DRIFT. Update the
  constant **in the same commit** to the value the run printed (or recompute,
  below). This is a deliberate ruler change; scores before and after are not
  comparable.

Recompute the fingerprint without a full run:

```bash
node -e 'const c=require("crypto"),fs=require("fs"),p=require("path");const h=c.createHash("sha256");const f=[p.resolve("scripts/v0/score.ts")];const d=p.resolve("specs/golden");for(const n of fs.readdirSync(d).filter(x=>x.endsWith(".ts")).sort())f.push(p.resolve(d,n));for(const x of f)h.update(fs.readFileSync(x));console.log(h.digest("hex").slice(0,12))'
```

## 3. Files to update

### a) `docs/handoff-compiler.html` — automated

Run the generator; it fills every baseline region from the JSON (hero card,
`SCORE`/`contract_pass_rate` block, the per-spec bar table, and the sparkline
point):

```bash
npx tsx scripts/v0/update_compiler_doc.ts /tmp/g.json
```

It's idempotent — re-running with the same budget replaces that budget's
sparkline point rather than appending a duplicate. It does NOT edit the
fingerprint constant or the markdown docs. The regions it owns are delimited by
`<!--BASELINE:…-->…<!--/BASELINE-->` markers (and `/*BASELINE:campaign*/` in the
script block); leave those markers in place.

### b) `GOAL_LDS_LOW_BUDGET.md` — by hand

This is prose, so it stays manual. Update:

- the **Current baseline** block: `goal_score`, `valid X/Y`,
  `contract_pass_rate`, `evaluator_fingerprint`.
- the **Current Frontier** section if *which* specs fail changed (the failing
  rows are `spec_scores` entries with `passed < total`).

### c) `scripts/v0/golden_suite.ts` — only if the ruler changed

Update `EVALUATOR_FINGERPRINT` (see §2). Skip otherwise.

## 4. Verify and commit

```bash
npx vitest run tests/v0_golden_config.test.ts   # spec list / config still valid
git add -A && git commit   # docs + (if ruler changed) the fingerprint constant
```

Confirm a fresh run prints no `⚠ DRIFTED` warning — that means the committed
fingerprint matches the live ruler.

## What is NOT a re-baseline

- Generated tracks/reports in `generated/` are gitignored working artifacts —
  regenerate, don't commit.
- The dashboard (`/dashboard/?report=…`) reads report JSON live; nothing to
  update there.
