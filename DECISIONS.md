# Decisions — v0 design

For each major design decision: what we chose, what we rejected, and why. This is the "why" companion to `DESIGN.md`. Read this when you wonder "why didn't we go with X?"

---

## Architecture

### D1. Two-layer architecture (Spec → compiler), not three (Spec → trajectory resolver → compiler)

**Chose**: Two layers. Spec is the authoring surface; the compiler does everything else.

**Rejected**: Three layers with a separate trajectory resolver that plans a target rider path using approximate physics, then a compiler that induces it with geometry.

**Why**: Approximate physics can produce trajectories that aren't engine-realizable — tunneling, ejection at impact, sled-constraint weirdness. A closed-loop compiler can absorb small drift between predicted and actual physics, but not qualitative divergence. The engine is line-bound; using it throughout (oracle pattern) means feasibility checking is built in. The trajectory resolver became extra surface area for no robustness gain.

### D2. Engine in the loop throughout the compiler, not approximate-physics planning

**Chose**: Every geometric decision in the compiler is validated against `lr-core` before commit.

**Rejected**: An approximate friction/gravity model used inside the compiler to predict trajectories without invoking the engine.

**Why**: Same as D1. The engine is fast enough (~4000 fps in Node) that the cost of consulting it is acceptable. Any speedup from approximation gets paid back in lost robustness.

### D3. Spec is the creative surface, not lines and not strategies

**Chose**: User authors `Spec` objects — a small declarative vocabulary describing artistic intent (sync events + per-section style axes).

**Rejected**: Authoring at the level of individual lines (too low — no musical meaning), or at the level of "strategies" (too procedural — strategies are how, not what, and conflate intent with algorithm).

**Why**: Sync precision needs to be a hard constraint, not a soft fitness term. Variety needs a vocabulary the user can express artistically. Neither is reachable at the line-level or strategy-level surface. The Spec layer is what makes both achievable.

---

## Spec design

### D4. Four axes (air, speed, contact_style, grain), not earlier drafts

**Chose**: `air`, `speed`, `contact_style`, `grain` — each measurable on a finished track, each with a precise float definition.

**Rejected**:
- First draft: `slide / climb / dive / air / wave` with `Land / Bounce / PassAltitude` events. Vocabulary was vague (what does "dive" mean? "slide" is what happens automatically), and Land/Bounce were detector quirks, not authorial intent.
- Texture tags (`aerial / bumpy / flowing / ground / wavy / dropping / rising`). These were combinations of dimensions packed into single labels; not orthogonal.
- A version with `shape` (concave / straight / convex) as a separate axis. `shape` and `contact_style` describe the same phenomenon (contact character) from different angles; redundant.

**Why**: The axes have to be (i) approximately orthogonal — moving one without strongly affecting others; (ii) measurable on a finished track for testing and reporting; (iii) creatively meaningful — the user has to think in this vocabulary. The final four pass all three tests; the earlier drafts didn't.

### D5. Dropped `altitude` from v0; added `speed` instead

**Chose**: No altitude axis. `speed` axis defined as `mean(|velocity|) / SPEED_CAP`.

**Rejected**: Altitude as `(y_end − y_start) / (g · duration² / 2)`.

**Why**: Altitude is a consequence of geometry, not an authorial intent — composers think "drop here" or "climb here", not "normalized y-delta over duration". The normalization made the axis insensitive at typical scales. Altitude was also tightly coupled with `air` (high-air sections net negative altitude by ballistics) and with speed (going down = speeding up). Speed is closer to how the user thinks about musical energy and naturally subsumes altitude's purpose.

### D6. Single `Contact` event, not separate `Land` / `Bounce` / `PassAltitude`

**Chose**: `Contact(t)` — rider must be in ground contact at time `t` within ±1 frame.

**Rejected**: Distinct event types for landing, bouncing, altitude waypoints.

**Why**: The Land/Bounce distinction is a detector quirk — the same physical event is sometimes reported as one or the other. No authorial intent says "I want a bounce here, not a landing." PassAltitude was waypoint overkill that v0 doesn't need.

### D7. No landing events at non-Contact frames

**Chose**: Treat "no landing event except at a Contact (±1 frame)" as a hard constraint, alongside Contact precision and rider survival.

**Rejected**: Letting the compiler introduce landings between beats — either as "natural" intermediate contacts emerging from physics or as synthetic anchors placed to break long airborne stretches into more tractable sub-problems.

**Why**: Off-beat landings produce un-musical hits — the audience sees the rider make ground contact at moments that don't align with the music, which directly subverts the project's purpose. Every visible landing must read as a beat. The cost is that sparse-Contact specs become more constrained (the rider must stay airborne long enough to span each gap), but those constraints surface in the DriftReport and the user can iterate the spec — typically by adding intermediate Contacts (which are then beats with musical justification) rather than letting the compiler invent un-musical ones.

### D8. Float axes with precise definitions, not enums (low/medium/high)

**Chose**: All axes are floats in `[0, 1]` or `[-1, +1]` with precise measurable definitions on a finished track.

**Rejected**: Coarse enums for easier authoring.

**Why**: Precise definitions force us to nail down what each extreme means, which gives testable acceptance criteria. Ergonomic constants (`low = 0.2`, `med = 0.5`, `high = 0.8`) can be added as sugar over the float type if authoring ergonomics demand it; the underlying representation stays precise.

### D9. Last-declared wins per axis for overlapping sections

**Chose**: Sections can overlap arbitrarily; effective axis at time `t` is determined by walking all covering sections in declaration order, last-defined wins per axis.

**Rejected**: Validation-enforced nesting (sections must be fully inside or fully outside another, partial overlap = error).

**Why**: Same expressive power, fewer error cases, fewer validation rules. Authoring is simpler when sections are independent declarations rather than a tree to maintain.

### D10. Three hard constraints, axes are soft

**Chose**: Two tiers.
- **Hard** (three constraints): Contact precision (±1f), rider survival, no off-beat landings. Violations are reported as distinct failures, not aggregated with soft drift.
- **Soft**: Per-section axis targets. Compiler tries to honor; achieved values reported; user iterates.

**Rejected**: Auto-tolerance gating per axis (treating axis errors as binary pass/fail with hardcoded ε).

**Why**: Sync is sacred — the project's reason for existing. Survival is binary — a dead rider isn't a valid track. Off-beat landings are sync's negative-space twin: the wrong things must not register as the right things. Other axes are aesthetic targets where "close enough" is judgment, not formula. Auto-tolerance gates would either be too tight (most specs fail) or too loose (defeats the purpose).

### D11. `air` clamped to ≤ 0.99

**Chose**: `air ∈ [0, 0.99]`.

**Rejected**: `air ∈ [0, 1]`.

**Why**: `contact_style` is undefined when there are zero contacts. `air = 1` produces zero contacts. The clamp ensures any spec has at least some contacts for `contact_style` to measure.

### D12. Axes acknowledged as non-orthogonal, but committed for v0

**Chose**: The four-axis vocabulary, with an explicit acknowledgment in the design that the axes are not strictly orthogonal. Document the known couplings; commit to the vocabulary for v0.

**Rejected**: Refusing to ship until the axes are mathematically independent. Cutting axes that overlap with others (e.g. dropping `air` because it's coupled with `speed`). Adding more axes to disambiguate the conflicts.

**Why**: `air` and `speed` are physically coupled (high airborne fraction requires launches, which require speed; airborne velocity is governed by ballistics). `grain` is a property the compiler controls directly while the others are rider-state measurements. These are real overlaps — but the system's value comes from being usable, and an "almost orthogonal" vocabulary that exposes the right creative controls is more useful than a "strictly orthogonal" one that's hard to reason about. When extreme targets conflict, the DriftReport surfaces the situation honestly and the user iterates. If the system handles non-orthogonal axes robustly, that's confidence-building toward later refinement; if it doesn't, we'll learn from the first real specs what to change.

---

## Compiler design

### D13. Arc as atomic primitive, not individual Lines

**Chose**: `Arc` — a parametric polyline (anchor, length, start/end angles, segment count, curve bias). Compiles to N Lines.

**Rejected**: Single Lines as the compiler's atomic move (too low-level — every curve is many lines, search space explodes); named "Move" types like the old code (too high-level — conflates intent with geometry).

**Why**: Arc is the granularity that matches how the compiler should reason — a single contact catch is one Arc. Multi-line shapes are atomic at the placement layer. Named presets (catch, kicker, slope) become factory functions that produce Arcs, not separate primitives.

### D14. Per-gap budget compilation, not global section-wide optimization

**Chose**: Hard Contacts slice the timeline into gaps. Each gap is solved as a local constraint-satisfaction problem with known start state, known end-frame Contact, and budget targets derived from covering sections. The compiler generates candidates per gap, filters by hard constraints, and picks the lowest-cost survivor.

**Rejected**:
- Hill-climbing over Arc parameters against section-wide axis distance. Converges to a single locally-optimal Arc shape; produces visually uniform tracks. Past attempts to fix this via fitness terms (old coolScore) did not work.
- Sampling Arc parameters from distributions centered on axis targets. Works only for `grain` (where the Arc parameter IS the axis); fails for `air`, `speed`, `contact_style` which are section-wide statistics that no single Arc directly determines.
- Synthetic intra-gap anchors to break long gaps into smaller sub-problems. These would be off-beat landings (forbidden — see D7).

**Why**: Per-gap budgets dissolve the global inverse problem into a sequence of local problems with measurable targets. Linearity of expectation makes section aggregates correct automatically. Survival and off-beat-landing constraints are enforced locally per candidate. Many candidates per gap, with RNG-driven choice among hard-gate survivors, produces variety without converging to uniformity.

### D15. Wide random Arc parameter sampling for candidate generation

**Chose**: Per gap, generate K candidate placements by drawing Arc parameters from wide uniform distributions over their bounds. The parameter bounds are tied loosely to the rider's current state (e.g. anchor offset relative to predicted trajectory) but the sampling is otherwise unbiased.

**Rejected**:
- Named archetypes (a discrete palette of `flat_catch`, `kicker`, `s_curve`, etc.) from which candidates are instantiated. This would be a preset library we explicitly deferred from v0.
- Axis-conditioned distributions, where the probability of sampling certain parameter ranges depends on the section's axis values (e.g. high-air sections bias toward steeper launches). This is "smart" candidate generation that we don't yet need.

**Why**: We don't know empirically yet whether wide random sampling produces enough structural variety, or whether the parameter space's hard-gate survivors all cluster into similar shapes. The experiment is: build v0 with wide random sampling, render some tracks, watch them. If candidates are visually uniform, *that's a v0.1 problem* — at which point archetypes, anti-correlation between consecutive gaps, or biased distributions become justified by observed need. We don't introduce them in v0 against a problem we haven't observed.

### D16. Fitness ranking by aggregate axis cost, not first-survivor

**Chose**: After hard-gate filtering, rank surviving candidates by `sum across axes of |achieved_axis − gap_target_axis|` and pick the lowest cost.

**Rejected**: Accepting the first candidate that satisfies the hard gate.

**Why**: First-survivor is greedy and myopic — a candidate that barely survives but has terrible axis fidelity gets committed even when a better one was a few samples away. Ranking by axis cost across the candidate pool is cheap (one sort) and meaningfully improves soft-target achievement. This is *not* the old coolScore — there's no global fitness function that variety has to fight; the cost is purely "distance from this gap's targets" and only ranks candidates that already passed all hard gates.

### D17. Cross-gap target sampling, not per-gap target = section target

**Chose**: For each axis, each gap targets a value sampled from `Normal(section_target, σ²)`. Cross-gap variation makes consecutive gaps feel genuinely different.

**Rejected**: Each gap targets the section's axis value exactly. Section aggregate is correct but every gap feels the same → monotone output even when individual Arcs vary.

**Why**: Without cross-gap variation, the compiler produces "70% air, 70% air, 70% air" — every beat feels identical. With sampling, gaps land in a range (e.g. [55%, 85%]) and the section average still hits 70% by linearity. Variety lives at both levels (cross-gap + within-gap).

### D18. σ as hidden v0 parameter; regularity axis in v0.1

**Chose**: σ (cross-gap target sampling spread) is a hidden compiler constant in v0 with a sensible default. In v0.1, σ becomes the user-facing `regularity` axis.

**Rejected**: Exposing `regularity` from v0.

**Why**: We need the mechanism (cross-gap target sampling) in v0 for variety to work. We don't need the creative control surface on it until users have a feel for what spreads matter. Adding it as an axis later is non-breaking; deferring keeps v0 vocabulary small.

### D19. Cross-gap backtracking, limited; no section-level backtracking

**Chose**: If a gap cannot produce any hard-gate survivor after K tries, retry the previous gap with its second-best candidate, giving this gap a different rider end-state to inherit. Up to 2 levels of cross-gap backtrack. If failure persists, record a hard failure for this gap in the DriftReport and continue with the best-surviving state from the most recent attempt.

**Rejected**:
- No backtracking at all (cascade failures whenever a gap fails).
- Unbounded backtracking that re-tries arbitrary previous decisions.
- Section-level backtracking that re-samples per-gap axis targets when failures propagate.

**Why**: Some failures are recoverable by upstream state changes — the previous gap left the rider in a marginal state; a different upstream choice would have worked. Bounded backtracking is cheap to implement and catches the common case. Unbounded backtracking adds search complexity and risk of pathological loops without clear benefit for v0. Section-level backtracking is more search than v0 warrants — we can add it in a later version if the bounded variant proves insufficient on real specs.

### D20. Survival is hard, not just reported

**Chose**: Compiler must keep the rider alive in every gap, or fail the gap audibly.

**Rejected**: `survived: bool` as DriftReport metadata only.

**Why**: A track where the rider dies mid-section has failed the spec, period. Treating survival as a soft outcome lets the compiler produce nonsense tracks. Making it hard forces the compiler to either find a solution or report inability — both honest.

### D21. Variety via seeded RNG, not anti-uniformity fitness terms

**Chose**: Compiler carries a seeded RNG throughout. Same Spec + different seed → genuinely different but spec-conforming Track.

**Rejected**: Anti-uniformity fitness terms (e.g., the old coolScore).

**Why**: Fitness terms can be gamed and add fragility. The cleaner answer is structural: design the compiler so it doesn't converge to uniformity in the first place (per-gap budgets + wide candidate sampling + RNG-driven choice among ranked survivors). Variety becomes a property of the architecture, not a corrective tax bolted on after.

### D22. Bisection for Contact precision with non-monotone fallback

**Chose**: For the Arc nearest each Contact, the compiler bisects an Arc parameter (typically anchor Y) until the engine confirms Contact landing within ±1 frame. When bisection diverges or oscillates (a non-monotone region of the parameter-vs-frame relationship), fall back to a coarse grid search over the parameter range. If neither converges, the candidate fails the hard gate.

**Rejected**:
- General search for Contact-hitting Arcs (overkill when the relationship is usually monotone locally).
- Assuming monotonicity always holds (silently produces nonsense when it doesn't — small parameter changes can change which sled point contacts first or whether the rider clears the geometry).

**Why**: Bisection is monotonic for the right parameter (anchor Y in the typical case) and converges fast. The existing `landUp()` / `bisectCurveOffset` work proved this in well-behaved cases. The non-monotone fallback handles the corner cases without burdening the typical path. If a candidate's geometry produces a discontinuous relationship and neither bisection nor grid search converges, the candidate is genuinely unworkable; rejecting it and trying another is the right answer.

---

## Deferred (v0.1+)

### D23. Optional adjuster layer above the compiler

Tries small variations of the spec (shift a Contact by ±1 frame, swap an axis value) using the compiler as a black-box evaluator. Useful for batch / unsupervised generation. Not needed until v0 produces tracks worth varying.

### D24. Per-Contact richness (sled point, approach character)

Per-section `contact_style` covers most per-event "feel" intent. Per-Contact richness adds authoring complexity that v0 doesn't need.

### D25. `slope` axis (categorical altitude direction)

If we later want explicit altitude-direction control beyond what `speed` implicitly provides, `slope: up | flat | down` can be added as a categorical fifth axis.

### D26. Per-section initial conditions override

For v0, single start state per spec. Sections inherit naturally. Per-section overrides add complexity for unclear gain.

### D27. Auto-iteration on DriftReport

User reads the DriftReport and adjusts the spec manually in v0. The adjuster layer (D23) eventually handles this automatically. v0 prioritizes a robust core; iteration UX is downstream.

### D28. Per-axis weights

Equal-weight loss for v0. Weights only matter when the compiler can't satisfy all axes simultaneously; frequency unknown until we run real specs. Adding `weights?: Partial<Section>` later is non-breaking.

### D29. Named Arc archetypes (presets)

Deferred preset library — `flat_catch`, `kicker`, `s_curve`, etc. as named factory functions producing Arcs. May become useful if v0's wide random sampling proves insufficient for visual variety. Cleanly addable later as factory functions over the existing Arc primitive.

### D30. Multi-Arc gap support

v0 places exactly one Arc per gap (the one bisected to land at the end-Contact). This is sufficient when the rider's incoming energy is something a single sloped catch can absorb. It is *not* sufficient when the rider has accumulated too much vy in a long initial fall or sparse-contact stretch — empirically observed when the first Contact is ≥ 2 seconds after spec start (rider arrives at vy ≈ 14, no single Arc in any reasonable parameter range survives the impact).

Deferred fix: per gap, allow the compiler to place a *sequence* of Arcs — e.g., one or more upstream Arcs that the rider only bounces off (no landing event, allowed by the no-off-beat-landings constraint) to bleed energy, followed by the catch Arc at the end-Contact. The bouncing geometry doesn't violate sync because bounces aren't landings.

---

## Conventions

- **Time units in spec**: seconds throughout. Frame conversion at parse time using engine framerate (40 fps).
- **Spec format**: TypeScript module exporting a `Spec` object. Composition, comments, helpers all available.
- **Determinism**: same Spec + same seed → byte-identical Track. Default seed = 0.
- **Calibration constants** (SPEED_CAP, LINE_LENGTH_CAP, σ, K, Arc parameter bounds, curveBias range) are marked `TODO calibrate` in code and tuned empirically against rendered tracks.
