# From a repertoire workspace to autonomous production

Approved on 2026-09-30. **Implementation in progress under the owner's full green light.**
This is the next campaign after the [integrated workspace delivery](repertoire-workspace-results-20260930.md),
preserved and pushed at `778a80ca`. It develops the
[creative repertoire roadmap](creative-repertoire-roadmap.md) into a complete
production workflow. Approval authorizes sustained execution of the whole campaign;
the stages below are internal milestones, not repeated requests for permission.
Execution and evidence are tracked in [the campaign ledger](production-repertoire-campaign.md).

## The outcome

Given a musical specification, a seed and a few broad creative preferences, the
real compiler should produce a complete, varied, visually interesting track with
excellent musical accuracy and reasonable computation. It should choose and
repeat constructions itself. Finished musical videos should show the result of
that same production system, without manually chosen showcase windows.

The owner particularly values scattered passages and substantial folded corners.
The latest feedback favors opposing control rails with folded, S-shaped and other
expressive connected shapes: without them, the rider often skips their distinctive
parts. Ordinary arcs provide a useful contrast for passages without control rails.
These preferences guide this campaign; they do not prove that unguided expressive
shapes can never work, or that today's implementations approach their potential.

Keep normal type-0 physical lines throughout. Preserve meaningful folds, bends
and fragmentation while improving accuracy. A flattened fold, an unused S bend,
or an ornamental second rail cannot count as delivering the requested behavior.
Purposeful flight remains part of Line Rider; continuous sliding over every
centimeter is not the objective. The final judgment of visual quality remains
the owner's, informed by complete videos.

## What needs to change

The current workspace is a useful, verified starting point, with five complete
arrangements and faithful native playback. Its plans are manually authored. Its
source compilation and subsequent composition have separate budgets, and repeated
scattered edits can repeatedly rebuild a continuation. Its default production
compiler still uses ordinary arcs; the richer workflow is not yet the normal
production route.

Two implementation details matter for this next step:

- In `arc_motion.ts`, allowing guides does not require their use. Production
  pruning in `arc_guidance.ts` removes untouched guides and trims others around
  measured contacts. Retaining the whole guide, as the paired recipe does, still
  does not establish that it directs the rider through the distinctive geometry.
- Current workspace scattered passages in `contact_composition.ts` retain
  measured fragments of a connected source's main and guide rails, then search
  the return from the realized state. They can include guide-derived fragments.
  Their lack of a guide toggle is an interface/construction choice, not a proof
  that every scattered passage has active control. Earlier direct scattered
  controllers remain comparison material, not a separate production pipeline.

The architecture should stay small: choose a reproducible construction plan,
realize it with shared physical search, and independently verify what was built.
Reuse concrete geometry definitions and working production infrastructure. Avoid
introducing an abstract motif hierarchy or a second compiler for the dashboard.

## 1. Make construction requests and realized behavior explicit

Establish a small shared representation for a requested construction and its
realization. Begin with ordinary arcs, folded rails, ripples, serpentine, terraces
and scattered passages. Review existing waves and facets for useful inclusion;
do not inflate diversity by counting visually equivalent settings as new styles.
Keep decorative archived constructions out of the default repertoire.

For connected shapes, distinguish a deliberate unguided request, a deliberate
guided request, and the existing accuracy-led permission to use guides. The last
remains useful for the ordinary reference. The initial automatic creative profile
uses guided folded/ripple/serpentine/terraced passages and unguided ordinary arcs;
it can also choose guided ordinary arcs. Unguided expressive alternatives remain
available for controlled studies without becoming an accidental default.

Define checks against emitted geometry and native trajectories: shape strength
and substantial extent; actual guide interaction; ordered passage through the
distinctive region; and retained shape after pruning. Use geometrical progress
and contact timelines, rather than only segment IDs or "one collision happened."
Include bypassed shapes, tiny nominal folds and untouched guides as negative
examples. Compare removal of a guide on a small diagnostic panel to understand
its effect; do not require every useful guide to be indispensable in isolation.

Calibrate simple, construction-specific realization checks against the existing
meaningful examples and known bypasses before freezing V5. Do not turn a universal
contact percentage into a beauty score. If a behavior cannot yet be checked
reliably, disclose that limitation rather than awarding an invented guarantee.
Scattered gets its own checks for physical fragmentation, meaningful contact and
entry/return; it does not need to pretend to be a two-rail construction.

**Deliverable:** one construction definition shared by compiler, evaluation and
viewer; explicit requested/realized records; focused tests that reject nominal
successes with the wrong physical behavior. This is groundwork for the campaign,
not a stand-alone contact-analysis detour.

## 2. Choose variety automatically, with a simple reproducible policy

Implement a useful first policy rather than waiting for a perfect theory of
musical arrangement. Group consecutive supports into short phrases, normally
two or three supports of the same construction. Respect existing authored phrase
boundaries where available, with deterministic handling of introductions, short
remainders, long gaps and endings. Do not split a support just to meet a quota.

Start with these **provisional planning weights**, measured over phrase choices:

| Choice | Initial weight | Intent |
|---|---:|---|
| Ordinary arc without an opposing guide | 30% | Open passages and contrast |
| Guided connected construction | 55% | Fold, S sweep, ripple, terraces or ordinary guided arc |
| Scattered construction | 15% | Strong visual interruption |

Initially distribute the guided share evenly over those five choices. Repeat
within phrases and discourage immediate repetition of the same construction in
the following phrase. These are starting preferences, not guaranteed percentages
of visible time or required quotas for every short track. Report actual support
counts, durations and realized guidance separately. Structural eligibility rules
must be explicit; a current inability to finish a scattered ending is an engineering
limitation to address, not a permanent artistic rule.

Expose a small creative configuration alongside the musical targets: allowed
repertoire, overall amount of variation and guided/open balance. Keep the initial
weights and phrase rules in one versioned policy. Detailed per-phrase editing
remains an advanced tool, not a prerequisite for using the compiler. Existing
music specifications need no per-beat geometry annotations.

Derive a separate diversity random stream from the seed. The same input, policy
and seed reproduce the same requested plan; different seeds can change it even
when musical jitter is zero. Increasing search effort must not reroll the plan.
Save both the plan and the realized choices. Search may adjust meaningful shape
parameters within the request, not erase its identity to win musical points.

When a choice is difficult, try bounded recovery within it. Any eventual
production fallback must be explicit and retain the failed request in the record.
An ordinary-arc substitution is not a successful folded request. Avoid repeatedly
redrawing the repertoire until the easiest plan succeeds.

**Deliverable:** whole-track plans for the available songs and a diverse synthetic
panel, with repeatability, zero-jitter diversity, boundary and distribution checks.
The simple initial policy is an artistic hypothesis to improve after full-video
review, not a claim that randomness alone understands the music.

## 3. Build and freeze V5 around the broader task

V5 should test musical accuracy while delivering varied requested constructions.
It need not make the music arbitrarily harder. Preserve the existing musical
judge, physics, timing/impact definitions and axis weights initially. Explicitly
version the broader construction contract, including scattered normal segments.
V4 stays frozen and remains an ordinary-arc compatibility reference: its existing
style contract excludes scattered passages. Its latest complete reference is
952.4726, with 352 valid runs and 176 distinct tracks.

Build two complementary V5 panels through the same production entry point:

1. **Fixed construction requests:** representative existing musical targets and
   additional necessary transition cases, with balanced guided shapes, unguided
   ordinary arcs, scattered passages, repetition, entrances, returns and endings.
   Requests are fixed independently of each compiler's success. This makes it
   impossible to improve solely by choosing easier shapes.
2. **Autonomous complete tracks:** musical inputs and frozen policy seeds whose
   construction plans are generated by the actual automatic policy. This measures
   the complete product, including its choice distribution and cumulative costs.

Use the existing musical score as the primary quantity. Publish a qualified
headline that counts physically invalid or unfulfilled construction requests as
failures, alongside the raw musical score, realization rate, per-construction
results, worst passages, requested/realized distribution and actual work. Freeze
the independent realization checks and failure aggregation explicitly. This is
request conformance, not a numerical claim about beauty. Do not hide an entire
weak construction inside an excellent aggregate.

Retain the full V4 as a companion report rather than multiplying its 176 cases by
every shape indiscriminately. Balance musical parents and construction coverage;
extra variants must not silently increase one song's weight. Define panel weights
and report each panel separately. Prioritize distinct musical situations and
diversity plans over repeated identical seeds. Reserve additional requests and
policy seeds before optimization for final confirmation; distinguish known songs
with fresh plans from genuinely new musical material.

Run a bounded development pilot at 750,000, 1.5 million and 3 million physics
frames, counting the entire compile. Use it to choose a practical primary budget
and corpus size, and to check the evaluation design. Then commit the complete
catalog, checks, aggregation, seeds and budget **before the canonical baseline and
compiler optimization**. Preserve pilot outcomes. Later discoveries of benchmark
defects require a recorded erratum/version, never quiet removal of hard cases.

**Deliverable:** a reproducible frozen V5, a complete starting baseline, paired
ordinary-reference diagnostics and a written failure/cost analysis. Aim for a
qualified V5 headline above 900 as a campaign ambition; feasibility and the actual
gap are unknown until this baseline exists. Never obtain that number by weakening
the requested geometry, musical targets or frozen evaluation.

## 4. Make the shared compiler excellent across the repertoire

Use V5 and targeted physical experiments for a sustained compiler campaign.
Investigate weak constructions instead of treating a disappointing first
implementation as a geometry limit. Prioritize the largest measured sources of
musical loss, missed realization and wasted work, including interactions between
them. Carry promising ideas through diagnosis and meaningful iterations.

The first research directions are:

- Search the main rail and opposing rail together, including guide onset, extent,
  separation and meaningful contact through the shaped region. Keep expressive
  geometry substantial while optimizing its placement and entry/exit motion.
- Condition proposals on the selected geometry, incoming physical state and
  musical targets. Audit ordinary-arc assumptions in initialization, coordinate
  choices, parameter ranges and learned/demonstrated proposals. Geometry-specific
  mathematics is appropriate; song-name or benchmark-case patches are not.
- Improve phrase transitions and short lookahead, especially unguided-to-guided,
  guided-to-scattered and the return. Preserve physical entry state and useful
  incumbents. Study local repair of a completed track where it actually buys
  quality, rather than repeatedly restarting an already satisfactory prefix.
- Develop scattered construction as a first-class choice. Compare improved
  contact reconstruction with the preserved direct normal-line controller where
  useful. Keep the visual fragmentation the owner likes; evaluate control,
  accuracy, continuation and cost without assuming a source-based method is final.
- Allocate extra work from measured progress and recoverability. Establish real
  budget/quality curves per construction and transition. Retry difficult entries
  intelligently and stop unproductive searches; do not equate a larger allowance
  with useful computation or repeat the unverified "99% is wasted" claim.

Use one end-to-end physics allowance covering source construction when needed,
preparation, previews, failed candidates, reconstruction, continuation search and
compiler replay. Share reusable state and avoid repeated full suffix construction
where possible. Report cold compilation separately from exact cache reuse;
independent judging and movie rendering have separately reported costs.

**Deliverable:** integrated improvements with matched-request, matched-work
comparisons, per-shape gains/regressions and wall-time evidence. Preserve
unsuccessful experiments compactly. A substantial design simplification may merit
a small disclosed quality tradeoff; neither exact historical track parity nor a
one-point change on a few cases should dictate architecture. Strong complete-suite
evidence and repeatable physical behavior should.

## 5. Finish production integration and qualification

Establish the public production route early enough that V5 and development use
the real implementation. Finish migration and hardening here. CLI production,
benchmark and gallery must call the same planner/compiler and construction code.
Adding creative options must not silently dispatch to the legacy backend.
Preserve explicit reference-engine behavior and the named ordinary profile used
for V4 comparisons; remove obsolete duplicated pathways after their consumers
have migrated and their useful experiments are archived.

Version and record musical-input identity, creative preferences, seed, policy,
compiler, requested plan, realized construction, exceptions and total cost. Cached
tracks and videos must match those identities. Keep normal-line validation, full
independent replay and the established production audio/timing adaptation.

Run full V5 and the reserved confirmation panel with the frozen final compiler,
plus full V4 through the ordinary profile. Exercise boundary conditions, low
budgets, failed realization, engine ownership, reference imports and exact
reproducibility where changes touch them. Verify that seeds produce distinct
plans/tracks; multiple seeds alone are not independent musical examples.

**Deliverable:** a documented normal production command that automatically makes
varied tracks, a complete evidence report, useful runtime bounds and a compact
configuration surface. The richer compiler should be a usable production mode,
not permanently depend on research scripts or hand-authored gallery plans.

## 6. Make the dashboard a library of actual production results

Reorganize the default experience around songs, seeds and broad creative settings.
Choose a song, generate a track, compare another seed, inspect its realized
construction timeline and watch its complete finished video. Keep exact native
rider/line rendering, faithful scrubbing, synchronized audio and useful local
comparisons. Preserve the manual editor as an advanced inspection tool.

Build a review collection covering every current production specification and
expand it with existing local music/specification pairs, starting with L'amour
de ma vie. Target at least four distinct songs with three predeclared seeds each,
plus ordinary references; include further songs when their actual recording and
timing alignment are verified. Different cuts of one song are not new songs.
Missing media is an asset limitation to report, not permission to present
synthetic companion specifications as music-synchronized productions.

Render full vertical videos with the established audio, overlays and
post-processing. Their geometry choices must come from the frozen automatic
policy, with no manual window tuning or seed hunting. Keep every scheduled
outcome visible, including failures and fallbacks. Additional contrasting creative
profiles can demonstrate the controls, with their actual settings recorded.

Present the music and track first. Make requested versus realized choices,
guide interaction, musical errors and work available for inspection. Verify real
playback, rapid song/seed changes, mobile use, job progress, cancellation and
cache identity. Reuse reliable rendering and worker infrastructure rather than
replacing it solely to make the dashboard look new.

**Deliverable:** a coherent production review library and reproducible generation
workflow that let the owner assess variety, guided/open balance, repeated phrases,
shape traversal, transitions and musical accuracy together.

## Execution and completion

After approval, carry these stages through as one sustained campaign. The order
is deliberate: meaningful requests, an automatic policy, a frozen evaluation,
compiler improvement, full qualification and production review. Integrate code
early and render representative results throughout so final videos do not reveal
an avoidable conceptual mistake at the end. These internal checks do not require
stopping after each new shape or minor experiment.

Completion means an autonomous production workflow, measured improvement across
the richer requests, preserved visual contrast, transparent remaining failures,
and a complete generated music library. A high headline alone, or another small
hand-arranged showcase, is insufficient. If the numerical ambition remains out
of reach, disclose the gap and actual evidence instead of declaring it achieved.

Commit and push coherent code, documentation and compact reproducible evidence.
Keep large archives, raw searches and media local. Preserve earlier approved
examples and the ordinary reference for comparisons. At the end, ask for one
substantial artistic review of the integrated result; use that feedback to choose
the following creative campaign.
