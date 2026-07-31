# Impact metric campaign — historical snapshot (2026-06-15)

> ARCHIVE: this document governed the retired net `redirArc` ruler. It is kept
> as decision history, not current implementation guidance. See
> `../impact_definition.md` and `../impact_contract.md`.

*The single source of truth for what we're solving, what we can change, what we must satisfy, and how
each piece of work (including labeling) serves a specific question. Supersedes earlier drafts. Last
rewritten 2026-06-15 after settling: felt-labels are not an absolute basis; the scale must be
physics-grounded and perceptually-validated.*

---

## 1. The goal

An author writes `impact ∈ [0,1]` per beat and gets a **meaningful, ordered, discriminating,
physically-achievable, reliable** amount of felt impact across the whole range — **without sacrificing
the other axes** (air / amplitude / elevation / speed). This scale is a **lasting foundation**: it must
be rock-solid, honestly derived, and reproducible — not tuned-to-a-number or eyeballed.

## 2. The chain (one authored number, four layers)

```
authored [0,1]  --calibration(anchors/curve)-->  target redirArc px
                                                        |
                                                  compiler/geometry
                                                        v
score [0,1]  <--measurement(same anchors/curve)--  achieved redirArc px
```
"Under control" = the chain is consistent end to end: **authored ≈ felt ≈ achieved**, with the other
axes intact. The scored quantity is `redirArc = v·Δθ` (incoming CoM speed × net heading-change over a
6-frame window), normalized `normImpact(px)=clamp01((px−SOFT)/(VSTRONG−SOFT))`.

## 3. The open QUESTIONS (what we are actually trying to answer)

- **Q1 — Is redirArc the RIGHT QUANTITY for felt impact?** Two ways it could be wrong: (a) *incomplete*
  — the same redirArc feels different in different contexts (a missing variable); (b) *wrong form* — the
  `v·Δθ` product is wrong (a fast-shallow turn and a slow-sharp turn at equal `v·Δθ` feel different).
  **Only perception can answer this. It is currently an untested assumption.**
- **Q2 — How should physical redirArc map to [0,1]?** The endpoints (SOFT, VSTRONG) and whether the map
  is linear in px or needs a perceptual curve.
- **Q3 — Can the compiler reliably ACHIEVE the target across the range?** Measured today: ~3× spread for
  the same authored value; setup-dependent (dense beats undershoot, roomy overshoot). The consistency gap.
- **Q4 — Does the calibration HOLD the other axes?** (`excl_impact`, anchor-independent.)
- **Q5 — How do the SPECS author impact?** The migration from the old convention, preserving intent.

## 4. What we've LEARNED (the facts, so far)

**Q1 (ordering) and Q3 (control) are now confirmed at the gross level (2026-06-15, probes + author's eye):**
- **Impact is a strong, DECOUPLED lever — it is not forced by air.** A 2×2 (impact×air) probe: at the
  *same high air*, low impact lands 1.2px/6° vs high impact 7.2px/34° — a **5.9× separation**. Low impact
  lands **genuinely smooth** regardless of air. The author *confirmed this by eye*: low-impact-high-air
  landings look smooth, clearly different from hard hits. So "smooth + lots of air" IS authorable, and
  redirArc's ordering tracks felt impact. (My earlier "air ⇒ incidental slam" was wrong — air = time
  airborne, achievable many ways, decoupled from landing steepness.)
- **Hard-impact control is good given setup**: ~66% of the (modeled) catch limit (9.6px / 42° turn on
  roomy aligned beats); the carrier is near-optimal (no knob beats it) — **keep the carrier as is**.
- **~20% beat-to-beat noise** even on identical ideal beats (selection/compile variance) — the accepted
  reliability floor.
- **The 64° "ceiling" is a heuristic, not a physical law** — it's `asin(CATCHABLE_REDIR_FRACTION=0.9)`,
  a single-number stand-in; the true catchable turn likely varies with speed and arc form. "% of physics"
  = % of a *modeled* cap. Measure the real envelope if it ever matters.
- The Phase-A "incidental floor overlaps the signal" was over the *corpus* and was **mis-attributed to
  air**; on clean beats impact is a clean lever. If incidental redirArc is a real issue it comes from
  **amplitude / grain / density**, not air — a narrower follow-up, not a foundation blocker.

**Earlier facts (still hold):**
- redirArc is **setup-dependent**: a non-redirecting catch → ~0px; well-set-up hard hits reach 5–13px.
  Bounded per-beat by physics (heuristic): `max redirArc = v·Δθ_max`, `Δθ_max = asin(0.9) ≈ 64°`.
  `impactCeiling(v)` caps infeasible asks honestly.
- Phase-A objective endpoints: **SOFT ≈ 1.2px** (median incidental floor), **VSTRONG ≈ 6.5–8px**
  (reliably-achievable hard hit; triangulates corpus p99=7.1 and the old felt 6.5). VSTRONG's exact
  value is the remaining perceptual call (where "very strong" saturates).
- The **clamp** at a low VSTRONG was *hiding* the variance + overshoot — many beats clamp to 1.0 while
  differing 3× in raw px. Removing it (raw px view) is what exposed Q1/Q3.
- The migration `migrateImpact(a)=normImpact(a·8.5)` **over-saturates** under low anchors (62% → 1.0);
  the **anchor-independent affine shift `(a−0.2)/0.8`** preserves intent without saturating.
- On 2 specs + the golden suite, **0/8 affine** improved `excl_impact` **+21.7** and gave a near-diagonal
  response — but the 0/8 anchors were **eyeballed on 2 specs**, which is not a foundation.
- **Felt labels are relative/within-spec, not absolute.** They cannot *set* the scale. The only
  objective, absolute basis is the **physics** of redirArc (floor 0, ceiling `v·1.12`).

## 5. The LEVERS (what we can change)

| Lever | What | Governs |
|---|---|---|
| **Metric** | the quantity (redirArc), the 6-frame window, the `v·Δθ` form | Q1 — change ONLY if perception falsifies it |
| **Scale** | SOFT, VSTRONG; linear-vs-curve mapping | Q2 |
| **Migration** | how old specs map onto the new scale (affine shift) | Q5 |
| **Compiler** | arc geometry (consistency, reach); `impactCeiling` per-beat cap | Q3 |

## 6. What we must SATISFY (acceptance — non-negotiable)

1. **Meaningful & ordered**: authored 0→1 is discriminating and monotone in felt impact.
2. **Achievable**: the whole range is physically reachable given setup; per-beat-infeasible asks are
   honestly capped, not faked.
3. **Reliable**: achieved tracks authored consistently (close the variance).
4. **Other axes hold**: `excl_impact` ≥ baseline (no collateral).
5. **Perceptually valid**: the scale's ordering matches felt ordering (Q1 passes).
6. **No trafficking & reproducible**: grounded in physics + perception, thresholds **pre-registered**
   before labeling, split-half reproducible. The score is an instrument, never the target.

## 7. The PLAN — each work-stream maps to a question

- **A. Objective anchoring** (physics + full-corpus achievable distribution, NO labels): derive the
  endpoints — SOFT = measured incidental floor, VSTRONG = reliably-achievable ceiling (cross-checked vs
  `v·1.12`). → part of **Q2**.
- **B. Perceptual validation (2AFC labeling)** — the *only* tool that answers **Q1** and the curve part
  of **Q2**. The author makes binary "which hit harder?" calls across multiple short tracks; a
  Thurstone/Bradley-Terry model assembles a latent felt-scale. From it we read: (i) does redirArc
  ordering match felt (Kendall τ); (ii) **context test** — same px, different spec → if it differs,
  redirArc is *incomplete*; (iii) **product-form test** — equal `v·Δθ`, different `v`/`Δθ` split → if it
  differs, the *form* is wrong; (iv) the perceptual **curve** (linear or a bend) and where it **saturates**
  (informs VSTRONG). **This is what the labeling is FOR — falsify/validate the metric and shape the
  scale. It does NOT set the endpoints and is not "matching to a number."**
- **C. Consistency** (compiler geometry / golden suite): **Q3**.
- **D. Collateral** (golden `excl_impact`): **Q4**.
- **E. Migration/re-bake** (affine, frozen on disk): **Q5**.
- **F. Lock**: set defaults, freeze the bake, fingerprint-includes-anchors, remove dead machinery.

**What needs labeling vs what does NOT** (keeps the human effort purposeful):
- Needs perception (B): Q1 (right quantity) + the curve-shape/saturation part of Q2. *Nothing else can
  answer these.*
- Does NOT need labeling: the endpoints' floor (physics/measurement, A), consistency (C), collateral
  (D), migration (E). Don't label for these.

## 8. Order of operations

1. **A** — derive objective endpoints from physics + the full corpus (gives a candidate scale, no labels).
2. **B** — perceptual validation: first answer **Q1** (is redirArc even right?) *before* investing in the
   exact curve. If Q1 fails, we fix the metric (a lever-1 change) before anything else — no point
   calibrating a wrong quantity.
3. **C/D** — close consistency and confirm no collateral on the golden suite.
4. **E/F** — freeze the migration on disk and lock the defaults.

The discipline: **A and B settle whether redirArc + which scale is even correct; only then do C–F build
on it.** Labeling exists to de-risk the foundation (Q1) and shape the scale (Q2) — not to tune a score.

## 9. STATUS — LOCKED (2026-06-15)

The calibration is locked and validated.

- **Metric:** `redirArc = v·Δθ` over a 6-frame window — author-validated as a faithful felt-impact measure.
- **Scale:** linear, **SOFT = 0** (physical floor: no redirection = no impact), **VSTRONG = 7.29** (auto-fit
  on a 1767-landing rich corpus with SOFT pinned 0; flat valley [7.3, 8.5]; corroborated by the achievable
  hard-hit ceiling and the author's perceptual "very strong"). A curve was tested and rejected — the
  deviations from diagonal are honest compiler-delivery (soft incidental floor + setup-dependent top
  undershoot), not perceptual non-linearity, and px is a faithful felt proxy so linear is the honest map.
- **Migration:** affine convention shift `a_new = clamp01((a_old − 0.2)/0.8)` is the DEFAULT
  (`LR_IMPACT_MIGRATE=legacy` restores the old `·REDIR_CAP` bridge for A/B). Anchor-INDEPENDENT, applied
  once at load by `withImpactLegacy` — no frozen-literal bake, so it can never double-apply.
- **Validation (full 40-golden, 150k×4):** `excl_impact` 647.98 → **661.92 (+13.9)** — other axes
  improve, zero collateral. Impact response monotone & near-diagonal (0.1→0.12 … 0.9→0.88), soft band
  alive. Canonical (100/200/300k × 12 seeds) confirmation run: see `generated/impact-study/canonical_lock`.
- **Hygiene:** `EVALUATOR_FINGERPRINT` now folds in the live anchors (was blind to them); bumped to
  `67adbf0fac9e`. Non-suite impact probe/demo specs moved out of `specs/golden/` to `scripts/v0/specs/`.
  Dead soft-band lever removed.
- **Tooling:** `scripts/v0/migrate_spec_impact.ts` — non-destructive reusable convention helper
  (report a spec's resolved impact, or convert old→new values) for updating specs on other clones.
- **Control (Q3) findings, accepted:** hard hits reach ~⅔ of the (heuristic) catch limit; impact is
  decoupled from air (author can write smooth + high-air); ~20% per-beat noise floor; the "64° ceiling"
  is a heuristic, not a hard law. Reaching beyond ⅔ is a future geometry campaign, not a calibration blocker.
