# V5: musical accuracy while realizing a varied repertoire

This benchmark implements the approved [production roadmap](../../docs/production-repertoire-roadmap.md).
The musical targets are unchanged copies of existing V3/V4 inputs. The normal-line
construction contract now includes guided shapes, deliberate unguided ordinary
arcs and physically contacted scattered fragments. V4 remains frozen separately.

The canonical panel has **75 cases × seeds 101/202**: 56 fixed requests (seven
construction/guide choices across eight musical contexts), plus 19 complete
automatic plans covering the existing musical groups. The reserved confirmation
panel has **40 cases × seeds 307/409**, using five additional source selections.
There are 22 distinct source specifications overall. These are known musical
programs with new requests, not 22 independent recordings or unseen music.

Fixed requests choose three consecutive supports at an early, middle, late or
ending position, using a score-blind hash. Different seeds can select different
windows. Surroundings remain ordinary, with guides permitted. Automatic requests
come from the actual versioned production policy and use the entire track.
Compiler changes cannot reroll those frozen plans to make evaluation easier.

## Score and realization

The musical judge, engine, detector, timing, impact, axis weights and tolerance
are the frozen V4 implementation. Each row reports that raw musical score.
Each scored support separately earns its share of that score if it fulfills its
construction, and zero otherwise. Thus a valid 960-point ride fulfilling two of
three requested supports scores 640 for V5. An invalid musical ride scores zero.
Startup is excluded from the construction share. Ordinary surroundings of fixed
requests cannot dilute their failures.

This gives a graded measure of actual delivered requests without discarding the
remaining work because one shape failed. **A high V5 score does not mean every
requested construction succeeded.** Full-fulfillment counts, per-support reasons,
raw musical scores, local errors and track validity are mandatory companion data.

The independent checks read emitted geometry and frozen-engine collisions:
normal lines; connected main rails where requested; no guide when forbidden;
physical guide contact when required; substantial shape extent/turning; ordered
contact progress through early/middle/late portions, including opposing contact;
three meaningful faces for folds; heading reversals for smooth shaped rails;
and disconnected, contacted short fragments for scattered requests. These are
coarse functional conformance checks. They do not certify beauty, continuous
sliding, exact artistic identity or contact with every bend. Full native playback
and complete musical videos remain necessary.

Aggregate seeds with the existing shifted geometric mean, then give equal weight
to musical parents within each construction family. Give equal weight to the
fixed construction families and equal weight to the automatic musical groups.
The fixed and automatic panels each contribute half the headline. Report them
separately. Variant counts cannot increase a parent's influence.

## Budget and freeze

The primary allowance is **3,000,000 actual compiler physics frames**, including
source creation, preparation, reconstruction, searches and compiler verification.
Independent benchmark judging and rendering are separate. The development pilot
tested 750,000, 1.5 million and 3 million. Its complete automatic Luna/Amor/Tiki
rides failed at 1.5 million and completed at 3 million, with raw musical scores
694.3 / 759.4 / 591.9. This motivates a practical starting allowance and exposes
the need for better quality and cost; it does not establish a budget optimum.
Retain smaller-budget curves during development.

Authoring reads no compiler outcomes. The complete catalog, independent checks,
weights, seeds and budget are committed before the canonical baseline. The
authoring program refuses to overwrite a frozen catalog. Evaluation verifies
both the V4 judge identity and V5 contract hashes. Changes to a frozen definition
require an explicit version/erratum, preserving preceding results.

Run `LR_ENGINE=wasm node --import tsx scripts/benchmark/v5.ts eval --out=DIR
--compiler-root=CHECKOUT --jobs=8` (one shell line). Use `--split=confirmation`
only after freezing the final candidate. `--ids=...` or a different `--budget=...`
produces a diagnostic panel. All scheduled outcomes remain recorded. Execution
errors are zero outcomes and are separately counted; a run with such errors is
not a successful compiler qualification.
